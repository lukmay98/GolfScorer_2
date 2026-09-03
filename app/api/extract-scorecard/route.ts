import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

// Change this if you want to try a different model from your AI Gateway
// models list (vercel.com/ai-gateway/models). Any vision-capable model works.
const MODEL = "anthropic/claude-sonnet-4-5";

const ScorecardSchema = z.object({
  suggested_course_name: z
    .string()
    .nullable()
    .describe("Course name printed on the card, if confidently readable, otherwise null."),
  tee_set_used: z
    .string()
    .describe('Which tee/gender column was used, e.g. "Normal Herren" or "White tees".'),
  holes: z
    .array(
      z.object({
        hole_number: z.number().int().min(1).max(18),
        par: z.number().int().min(3).max(6),
        handicap_index: z.number().int().min(1).max(18),
      })
    )
    .describe("Exactly 18 holes, numbered 1 to 18."),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file is not an image." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { object } = await generateObject({
      model: MODEL,
      schema: ScorecardSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are reading a photo of a golf scorecard. Extract the hole number, par, and stroke/handicap index (sometimes labeled "HCP", "Index", "S.I.", "Strokes Index", or similar) for all 18 holes.

Some scorecards print multiple tee sets or gender columns (e.g. "Herren"/"Damen", "Normal"/"Champion", men's/women's/senior tees, colored tee boxes). When there are multiple par or handicap-index columns, use the leftmost / first / standard ("Normal") set of values rather than the furthest-back championship tees, and report which set you used in tee_set_used.

Return exactly 18 holes, numbered 1 to 18, combining the front nine and back nine if they're shown as separate tables. Par values are normally 3, 4, or 5. Handicap/stroke index values should be a permutation of 1 to 18 with no repeats — double check your reading if they aren't. If you can also confidently read a course name printed on the card, include it in suggested_course_name, otherwise leave it null.`,
            },
            { type: "image", image: buffer },
          ],
        },
      ],
    });

    return NextResponse.json(object);
  } catch (err) {
    console.error("extract-scorecard error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed. Try a clearer photo." },
      { status: 500 }
    );
  }
}