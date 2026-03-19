import { GoogleGenAI } from "@google/genai";
import { SiteSurveyData, SignConfig } from "../types";

// This service leverages Gemini to act as a "Senior Installation Manager"
// analyzing the site conditions against the sign configuration.

export const generateInstallationTicket = async (
  config: SignConfig,
  survey: SiteSurveyData
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Act as a Senior Signage Installation Manager.
      Create a succinct Installation Safety & Logistics Ticket for the following project:

      SIGN SPEC:
      Type: ${config.type}
      Size: ${config.dimensions.calculatedWidth}" W x ${config.dimensions.height}" H x ${config.dimensions.depth}" D
      Mount: ${config.mount}
      Weight (Est): ${config.dimensions.calculatedWidth * 0.5} lbs

      SITE CONDITIONS:
      Wall: ${survey.wallType}
      Install Height: ${survey.installHeight} ft
      Access: ${survey.accessType}
      Power: ${survey.powerAccess}

      Output strict Markdown with these sections:
      1. ## Risk Assessment (High/Med/Low)
      2. ## Hardware Requirements (Specific anchors for ${survey.wallType})
      3. ## Equipment Manifest
      4. ## Crew Instructions (Brief)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Failed to generate ticket.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Error generating installation ticket. Please ensure API Key is valid. \n\nSystem Fallback:\n- Use standard anchors for ${survey.wallType}.\n- Ensure ${survey.accessType} is booked.`;
  }
};