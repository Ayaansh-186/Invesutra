import { createSocialImage, socialImageSize } from "@/lib/socialImage";

export const alt = "Invesutra mutual fund portfolio intelligence";
export const size = socialImageSize;
export const contentType = "image/png";

export default function TwitterImage() {
  return createSocialImage();
}
