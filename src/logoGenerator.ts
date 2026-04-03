import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateLogo() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'A modern, minimal app logo for "TeamUp". Rounded square app icon with a purple gradient background from #6C5CE7 to #8E7CFF. In the center, a clean white flat icon representing two people connecting or collaborating. Flat design, no shadows, no 3D. Startup style, simple and memorable.',
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function generateSplashScreen() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'A mobile app splash screen for "TeamUp". A centered app logo (two people connecting icon) on a full-screen purple gradient background (#6C5CE7 to #8E7CFF). Minimalist, clean, startup style. The text "TeamUp" is elegantly placed below the icon in white. 9:16 aspect ratio.',
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "9:16",
      },
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
