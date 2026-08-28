export function parseFolderUploadPath(relativePath: string) {
  const segments = relativePath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");

  if (!segments.length) throw new Error("文件路径无效");
  if (segments.some((segment) => segment === "..")) {
    throw new Error("文件夹路径不能包含上级目录");
  }

  return {
    folders: segments.slice(0, -1),
    fileName: segments.at(-1)!,
  };
}
