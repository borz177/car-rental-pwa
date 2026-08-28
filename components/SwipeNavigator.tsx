import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppView } from '../types';

export interface NavEntry {
  view: AppView;
  entityId: string | null;
}

export type NavDirection = 'push' | 'pop' | 'none';

interface SwipeNavigatorProps {
  /** Текущий экран. */
  entry: NavEntry;
  /** Экран под текущим — тот, на который вернёт свайп. null, если возвращаться некуда. */
  prev: NavEntry | null;
  /** Как попали на текущий экран: вперёд, назад или переключением раздела (без анимации). */
  direction: NavDirection;
  /** Меняется при каждой навигации — по нему запускается анимация. */
  navToken: number;
  onBack: () => void;
  render: (view: AppView, entityId: string | null) => React.ReactNode;
  /** Жесты и анимации только на компактной раскладке (телефон). */
  enabled: boolean;
  /** Отступы/фон для каждого слоя-экрана. */
  layerClassName?: string;
}

const EDGE_ZONE = 32;         // px от левого края, где жест вообще начинается
const START_THRESHOLD = 8;    // px горизонтали до захвата жеста
const COMMIT_RATIO = 0.35;    // доля ширины, после которой отпускание завершает возврат
const COMMIT_VELOCITY = 0.35; // px/мс — быстрый флик завершает возврат и на малой дистанции
const PARALLAX = 0.25;        // насколько нижний экран отстаёт от верхнего (как в iOS)
const DIM = 0.18;             // затемнение нижнего экрана, пока верхний его перекрывает
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURATION = 340;

const keyOf = (e: NavEntry) => `${e.view}|${e.entityId ?? ''}`;

// Слой-экран: собственный контейнер прокрутки, помнящий свою позицию между появлениями.
// Вынесен в компонент, чтобы ref был стабильным — инлайновый ref-колбэк пересоздавался бы
// на каждом рендере, React дёргал бы его с null и заново, и во время жеста прокрутка
// сбрасывалась бы по нескольку раз в секунду.
const PageLayer = React.forwardRef<HTMLDivElement, {
  entryKey: string;
  memory: React.MutableRefObject<Map<string, number>>;
  className: string;
  onTransitionEnd?: (e: React.TransitionEvent<HTMLDivElement>) => void;
  ariaHidden?: boolean;
  children: React.ReactNode;
}>(({ entryKey, memory, className, onTransitionEnd, ariaHidden, children }, forwarded) => {
  const innerRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (typeof forwarded === 'function') forwarded(el);
    else if (forwarded) (forwarded as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const saved = memory.current.get(entryKey);
    if (saved) el.scrollTop = saved;
  }, [entryKey]);

  return (
    <div
      ref={setRefs}
      className={className}
      onScroll={(e) => memory.current.set(entryKey, e.currentTarget.scrollTop)}
      onTransitionEnd={onTransitionEnd}
      aria-hidden={ariaHidden}
    >
      {children}
    </div>
  );
});
PageLayer.displayName = 'PageLayer';

// Возврат назад в стиле нативных приложений: жест от левого края тянет текущий экран
// вправо, под ним с параллаксом выезжает предыдущий. Отпускание за порогом (или быстрый
// флик) завершает переход, иначе экран пружинит обратно. Программная навигация
// (кнопки «Назад», переходы по карточкам) проигрывает ту же анимацию без жеста.
//
// Экраны — абсолютные слои со своим скроллом, а не поток внутри одного скролл-контейнера:
// иначе во время жеста верхний и нижний экран делили бы одну прокрутку, и позиция нижнего
// скакала бы на глазах. Побочный плюс — прокрутка каждого экрана запоминается и
// восстанавливается при возврате, как в нативной навигации.
const SwipeNavigator: React.FC<SwipeNavigatorProps> = ({
  entry, prev, direction, navToken, onBack, render, enabled, layerClassName = ''
}) => {
  // 0 — текущий экран на месте; 1 — уехал за правый край, предыдущий полностью открыт.
  const [progress, setProgress] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Экран, который уезжает вправо во время возврата (в entry уже лежит новый текущий).
  const [outgoing, setOutgoing] = useState<NavEntry | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const topElRef = useRef<HTMLDivElement | null>(null);
  const underElRef = useRef<HTMLDivElement | null>(null);
  const dimElRef = useRef<HTMLDivElement | null>(null);

  const progressRef = useRef(0);
  const seedRef = useRef(0);          // прогресс, накопленный жестом до коммита
  const pendingRef = useRef<number | null>(null);
  const tokenRef = useRef(navToken);
  const lastEntryRef = useRef(entry);
  const scrollMemory = useRef(new Map<string, number>());

  // Значения, нужные обработчикам жеста, который навешивается один раз.
  const prevRef = useRef(prev);
  const outgoingRef = useRef(outgoing);
  const onBackRef = useRef(onBack);
  useEffect(() => { prevRef.current = prev; });
  useEffect(() => { outgoingRef.current = outgoing; });
  useEffect(() => { onBackRef.current = onBack; });
  useEffect(() => { lastEntryRef.current = entry; });

  // Позиции слоёв пишем в DOM напрямую, а не через style-проп. Две причины:
  // 1) во время жеста это позволяет не гонять React-рендер обоих экранов на каждый кадр;
  // 2) React сравнивает style с предыдущими пропсами, а не с реальным DOM — после наших
  //    прямых записей он счёл бы «значение не изменилось» и не вернул бы экран на место.
  const paint = (p: number, withTransition: boolean) => {
    const transition = withTransition ? `transform ${DURATION}ms ${EASE}` : 'none';
    if (topElRef.current) {
      topElRef.current.style.transition = transition;
      // В покое трансформ снимаем полностью: элемент с transform становится containing
      // block для position:fixed внутри себя, и модальные окна страниц перестали бы
      // накрывать всё окно (на десктопе — уезжали бы вбок от боковой панели).
      topElRef.current.style.transform =
        p === 0 && !withTransition ? '' : `translate3d(${p * 100}%, 0, 0)`;
    }
    if (underElRef.current) {
      underElRef.current.style.transition = transition;
      underElRef.current.style.transform = `translate3d(${-PARALLAX * (1 - p) * 100}%, 0, 0)`;
    }
    if (dimElRef.current) {
      dimElRef.current.style.transition = withTransition ? `opacity ${DURATION}ms ${EASE}` : 'none';
      dimElRef.current.style.opacity = String(DIM * (1 - p));
    }
  };

  const applyProgress = (v: number) => {
    progressRef.current = v;
    setProgress(v);
  };

  // Навигация произошла — ставим стартовое положение до отрисовки, чтобы не было вспышки.
  useLayoutEffect(() => {
    if (tokenRef.current === navToken) return;
    const from = lastEntryRef.current;
    tokenRef.current = navToken;
    lastEntryRef.current = entry;

    if (!enabled || direction === 'none') {
      setOutgoing(null);
      setAnimating(false);
      applyProgress(0);
      pendingRef.current = null;
      seedRef.current = 0;
      return;
    }

    setAnimating(false);
    if (direction === 'push') {
      setOutgoing(null);
      applyProgress(1);       // новый экран за правым краем...
      pendingRef.current = 0; // ...и едет на место
    } else {
      setOutgoing(from);
      applyProgress(seedRef.current); // возврат продолжается с той точки, где отпустили палец
      pendingRef.current = 1;
    }
    seedRef.current = 0;
  }, [navToken]);

  // Запускаем переход отдельным кадром: стартовый transform должен успеть примениться,
  // иначе браузер схлопнет старт и финиш в одно значение и анимации не будет.
  useEffect(() => {
    if (pendingRef.current === null) return;
    const target = pendingRef.current;
    pendingRef.current = null;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnimating(true);
      applyProgress(target);
    }));
    return () => cancelAnimationFrame(id);
  }, [navToken]);

  // Жест. Слушатели нативные: React вешает touchmove пассивно, а нам нужен preventDefault,
  // чтобы во время горизонтального свайпа не уезжала вертикальная прокрутка.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !enabled) return;

    let start: { x: number; y: number } | null = null;
    let active = false;
    let width = 1;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (!prevRef.current || outgoingRef.current) return; // возвращаться некуда / уже анимируем
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) return;
      start = { x: t.clientX, y: t.clientY };
      active = false;
      width = el.clientWidth || window.innerWidth;
      lastX = t.clientX;
      lastT = performance.now();
      velocity = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      if (!active) {
        // Пока не решили, жест это или вертикальная прокрутка — не мешаем ни тому, ни другому.
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > START_THRESHOLD) { start = null; return; }
        if (dx < START_THRESHOLD) return;
        active = true;
        setDragging(true);   // один рендер: под текущим экраном появляется предыдущий
        setAnimating(false);
      }

      const now = performance.now();
      if (now > lastT) velocity = (t.clientX - lastX) / (now - lastT);
      lastX = t.clientX;
      lastT = now;

      e.preventDefault();
      const p = Math.max(0, Math.min(1, dx / width));
      progressRef.current = p;
      paint(p, false);       // без setState: за пальцем следуем прямой записью в DOM
    };

    const onEnd = () => {
      if (!start) return;
      const wasActive = active;
      start = null;
      active = false;
      if (!wasActive) return;

      setDragging(false);
      const p = progressRef.current;
      if (p > COMMIT_RATIO || velocity > COMMIT_VELOCITY) {
        // Дотянули — завершаем возврат: onBack сменит экран, а эффект навигации выше
        // подхватит анимацию с текущей точки (seedRef), без рывка.
        seedRef.current = p;
        onBackRef.current();
      } else {
        setAnimating(true);
        applyProgress(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  const finishAnimation = () => {
    setAnimating(false);
    if (outgoingRef.current) {
      // Гасим уходящий слой и возвращаем прогресс в 0 одним обновлением — иначе между
      // этими двумя рендерами новый текущий экран мигнёт за правым краем.
      setOutgoing(null);
      applyProgress(0);
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Только собственный transform слоя: transitionend всплывает и от кнопок внутри экрана.
    if (e.propertyName !== 'transform' || e.currentTarget !== e.target) return;
    finishAnimation();
  };

  // Страховка: если конечное положение совпало с текущим (жест дотянули ровно до края),
  // браузер не пришлёт transitionend — и уходящий экран остался бы висеть навсегда.
  useEffect(() => {
    if (!animating) return;
    const id = setTimeout(finishAnimation, DURATION + 80);
    return () => clearTimeout(id);
  }, [animating]);

  // Во время возврата верхний слой — уходящий экран, нижний — тот, куда возвращаемся.
  const topEntry = outgoing ?? entry;
  const underEntry = outgoing ? entry : prev;
  const showUnder = !!underEntry && (dragging || animating || progress > 0);

  // Объявлен последним, чтобы отработать после эффектов навигации и увидеть их состояние.
  // Без списка зависимостей: DOM должен получать актуальные позиции после каждого рендера,
  // в том числе после того, как жест успел записать туда что-то своё.
  useLayoutEffect(() => {
    paint(progressRef.current, animating && !dragging);
  });

  const layerBase = `absolute inset-0 overflow-y-auto overscroll-contain ${layerClassName}`;

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden">
      {showUnder && underEntry && (
        <PageLayer
          key={keyOf(underEntry)}
          ref={underElRef}
          entryKey={keyOf(underEntry)}
          memory={scrollMemory}
          className={layerBase}
          ariaHidden
        >
          {render(underEntry.view, underEntry.entityId)}
        </PageLayer>
      )}

      {/* Затемнение нижнего экрана — отдельным слоем между экранами, а не внутри нижнего:
          внутри он ехал бы вместе с параллаксом и прокруткой своего экрана. */}
      {showUnder && (
        <div ref={dimElRef} className="pointer-events-none absolute inset-0 bg-black opacity-0" aria-hidden />
      )}

      <PageLayer
        key={keyOf(topEntry)}
        ref={topElRef}
        entryKey={keyOf(topEntry)}
        memory={scrollMemory}
        className={layerBase}
        onTransitionEnd={handleTransitionEnd}
      >
        {render(topEntry.view, topEntry.entityId)}
      </PageLayer>
    </div>
  );
};

export default SwipeNavigator;
