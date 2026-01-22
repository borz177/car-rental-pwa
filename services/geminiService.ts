
import { GoogleGenAI } from "@google/genai";
import { Car, Rental } from "../types";

export const getFleetInsights = async (cars: Car[], rentals: Rental[]) => {
  // Safe check for API Key in browser environment
  const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : (window as any).API_KEY;

  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI Insights disabled.");
    return "Для работы ИИ-аналитики необходимо настроить API_KEY в переменных окружения.";
  }

  const ai = new GoogleGenAI({ apiKey });

  const fleetSummary = cars.map(c => `${c.brand} ${c.model} (${c.category}) - ${c.status}, цена: ${c.pricePerDay} руб`).join('; ');
  const recentRev = rentals.reduce((acc, r) => acc + r.totalAmount, 0);

  const prompt = `Проанализируй текущий автопарк: ${fleetSummary}.
  Общая выручка: ${recentRev} руб.
  Дай 3-4 конкретных совета на русском языке по:
  1. Оптимизации цен на основе статусов.
  2. Какую категорию авто стоит докупить.
  3. Риски (пробег, ремонты).
  Отвечай кратко, профессионально и по делу.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Ты — эксперт-аналитик по автопрокату в России. Твоя задача - помогать владельцу бизнеса увеличивать прибыль.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Не удалось получить аналитику от ИИ. Проверьте соединение или настройки API.";
  }
};
