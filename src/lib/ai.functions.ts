import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const processReceipt = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    image: z.string(), // base64
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      console.warn("OPENAI_API_KEY não configurada. Usando fallback de mock.");
      return {
        description: "Compra via Foto (Mock)",
        amount: (Math.random() * 100).toFixed(2),
      };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extraia o valor total e o nome do estabelecimento deste comprovante. Responda apenas um JSON com os campos 'description' e 'amount' (número string com 2 casas decimais)." },
                {
                  type: "image_url",
                  image_url: {
                    url: data.image,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" }
        })
      });

      const result = await response.json();
      const content = JSON.parse(result.choices[0].message.content);
      
      return {
        description: content.description || "Compra via Foto",
        amount: content.amount || "0.00",
      };
    } catch (error) {
      console.error("Erro na OpenAI:", error);
      throw new Error("Falha ao processar imagem com OpenAI");
    }
  });
