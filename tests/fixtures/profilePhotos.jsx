import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ProfilePhoto, { PhotoUrlContext } from "../../src/components/ProfilePhoto";
import { createPhotoUrlResolver, validateProfilePhoto } from "../../src/profilePhotos";

window.photoCalls = [];
window.validatePhoto = validateProfilePhoto;
const resolve = createPhotoUrlResolver({ storage: { from: () => ({
  createSignedUrl: async (path) => {
    window.photoCalls.push(path);
    const version = window.photoCalls.filter((value) => value === path).length;
    const broken = path === "broken" || (path === "retry" && version === 1);
    return { data: { signedUrl: `/test-photo/${broken ? "broken" : "valid"}.svg?v=${version}` } };
  },
}) } });
function Fixture() {
  const [src, setSrc] = useState("first");
  window.changePhoto = setSrc;
  return <PhotoUrlContext.Provider value={resolve}>
    <ProfilePhoto src={src} alt="Foto peserta" initials="AP" />
  </PhotoUrlContext.Provider>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
