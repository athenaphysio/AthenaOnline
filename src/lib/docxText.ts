import "server-only";
import JSZip from "jszip";

// A .docx is a zip archive; word/document.xml holds the actual text, with
// content wrapped in <w:t> runs. This deliberately doesn't try to preserve
// structure -- it's read by an AI extraction step next, not displayed --
// just newlines at paragraph boundaries so sentences don't run together.
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Couldn't find word/document.xml -- is this a valid .docx file?");
  }

  return documentXml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
