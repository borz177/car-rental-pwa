
import { GoogleGenAI } from "@google/genai";
import { Car, Rental } from "../types.ts";

export const getFleetInsights = async (cars: Car[], rentals: Rental[]) => {
  /* Initialize GoogleGenAI inside the function to ensure the latest API key is used as per guidelines */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
        /* Move identity and expertise to systemInstruction as per recommendations */
        systemInstruction: "Ты — эксперт-аналитик по автопрокату в России.",
      },
    });
    /* Access .text property directly instead of calling a method */
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Не удалось получить аналитику от ИИ. Пожалуйста, попробуйте позже.";
  }
};
