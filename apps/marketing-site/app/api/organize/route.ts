import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FileToOrganize {
  name: string;
  dataUrl?: string;
  imageData?: string;
  isScreenshot: boolean;
}

interface ProjectSample {
  projectName?: string;
  name?: string;
  sampleImages: string[];
  files?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      files,
      projectSamples,
      albumSamples,
      existingAlbums,
      batchIndex,
      totalBatches,
    } = body as {
      files: FileToOrganize[];
      projectSamples?: ProjectSample[];
      albumSamples?: ProjectSample[];
      existingAlbums?: string[];
      batchIndex?: number;
      totalBatches?: number;
    };

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const safeProjectSamples = projectSamples || albumSamples || [];
    const sampleNames = safeProjectSamples
      .map((p) => p.projectName || p.name)
      .filter((name): name is string => Boolean(name));
    const allAlbumNames = Array.from(
      new Set([...(existingAlbums || []), ...sampleNames]),
    );

    // Build system prompt with project context
    let systemPrompt = `You are an AI assistant that helps organize screenshots and screen recordings into album folders.
Your task is to analyze each file and suggest the most appropriate existing project folder, or suggest creating a new one.

Available existing albums: ${
      allAlbumNames.length > 0 ? allAlbumNames.join(", ") : "None yet"
    }

For each file, respond with a JSON array of objects, each containing:
- fileName: the original file name
- suggestedAlbum: the album folder name (use an existing one if appropriate, or suggest a new descriptive name)
- reason: brief explanation of why this project was chosen
- confidence: "high", "medium", or "low"

Respond ONLY with the JSON array, no other text.`;

    // Build content array with images
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    // Add project samples for context if available
    if (safeProjectSamples.length > 0) {
      content.push({
        type: "text",
        text: "Here are sample images from existing projects to help you understand what content goes where:\n",
      });

      for (const project of safeProjectSamples) {
        const projectName = project.projectName || project.name || "Unknown";
        const validSamples = (project.sampleImages || []).filter(
          (url) => url && typeof url === "string" && url.startsWith("data:")
        );
        if (validSamples.length > 0 || (project.files || []).length > 0) {
          content.push({
            type: "text",
            text: `\nAlbum "${projectName}" contains examples like:`,
          });
          if (project.files && project.files.length > 0) {
            content.push({
              type: "text",
              text: project.files.slice(0, 6).join("\n"),
            });
          }
          for (const sampleUrl of validSamples.slice(0, 2)) {
            content.push({
              type: "image_url",
              image_url: { url: sampleUrl, detail: "low" },
            });
          }
        }
      }

      content.push({
        type: "text",
        text: "\n\nNow analyze these new files and suggest which project each belongs to:\n",
      });
    }

    // Add files to analyze
    for (const file of files) {
      const dataUrl = file.dataUrl || file.imageData;
      const hasImage = typeof dataUrl === "string" && dataUrl.startsWith("data:");
      content.push({
        type: "text",
        text: `\nFile: ${file.name} (${
          file.isScreenshot ? "screenshot" : "recording"
        })`,
      });
      if (hasImage) {
        content.push({
          type: "image_url",
          image_url: { url: dataUrl, detail: "low" },
        });
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "[]";

    // Parse JSON response
    let suggestions: Array<{
      fileName: string;
      suggestedAlbum?: string;
      suggestedProject?: string;
      reason: string;
      confidence?: string;
    }>;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = [];
      }
    } catch {
      console.error("Failed to parse AI response:", responseText);
      suggestions = [];
    }

    // Calculate cost estimate
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;

    const normalizedSuggestions = (suggestions || []).map((s) => ({
      fileName: s.fileName,
      suggestedAlbum: s.suggestedAlbum || s.suggestedProject || "Inbox",
      reason: s.reason || "",
      confidence: s.confidence,
    }));

    return NextResponse.json({
      success: true,
      suggestions: normalizedSuggestions,
      batchIndex,
      totalBatches,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        model: "gpt-4o",
      },
    });
  } catch (error) {
    console.error("Organize API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
