"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Project = { id: string; name: string; code: string };
type FolderItem = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  path: string;
  project?: { name: string };
  creator?: { name: string };
};
type FileItem = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  size: number;
  tags: string[];
  deletedAt: string | null;
  project: { name: string };
  creator: { name: string } | null;
  currentVersion: { version: number } | null;
  _count: { versions: number; links: number };
};
type Data = {
  projects: Project[];
  folders: FolderItem[];
  treeFolders: FolderItem[];
  files: FileItem[];
  storage: { used: number; limit: number; warning: boolean; blocked: boolean };
};

export function FileManager({ lockedProjectId }: { lockedProjectId?: string }) {
  const [data, setData] = useState<Data | null>(null),
    [projectId, setProjectId] = useState(lockedProjectId || ""),
    [folderId, setFolderId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [uploading, setUploading] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [versionTarget, setVersionTarget] = useState<string | null>(null),
    [trash, setTrash] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    versionInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (folderId) params.set("folderId", folderId);
    if (trash) params.set("trash", "1");
    try {
      const response = await fetch(`/api/files?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "加载文件失败");
      setData(body);
      if (!projectId && lockedProjectId) setProjectId(lockedProjectId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载文件失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, folderId, trash, lockedProjectId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const visibleFiles = useMemo(
    () =>
      data?.files.filter((file) =>
        file.name.toLowerCase().includes(query.toLowerCase()),
      ) || [],
    [data, query],
  );
  const crumbs = useMemo(() => {
    if (!folderId || !data) return [];
    const result: FolderItem[] = [];
    let current = data.treeFolders.find((folder) => folder.id === folderId);
    while (current) {
      result.unshift(current);
      current = data.treeFolders.find(
        (folder) => folder.id === current?.parentId,
      );
    }
    return result;
  }, [data, folderId]);
  async function createFolder() {
    if (!projectId) return setError("请先选择项目");
    const name = window.prompt("新文件夹名称");
    if (!name) return;
    const response = await fetch("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, parentId: folderId, name }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "创建失败");
    await load();
  }
  async function upload(files: FileList | null, targetFileId?: string) {
    if (!files?.length || !projectId) return;
    for (const file of Array.from(files)) {
      setUploading(`正在上传 ${file.name}`);
      try {
        const start = await fetch("/api/files/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            folderId,
            fileId: targetFileId,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
        const started = await start.json();
        if (!start.ok) throw new Error(started.error || "无法开始上传");
        const partSize = started.upload.partSize,
          partCount = Math.ceil(file.size / partSize),
          numbers = Array.from({ length: partCount }, (_, index) => index + 1),
          completed: { partNumber: number; etag: string }[] = [];
        for (let offset = 0; offset < numbers.length; offset += 50) {
          const batch = numbers.slice(offset, offset + 50),
            signedResponse = await fetch(
              `/api/files/uploads/${started.upload.id}/parts`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ partNumbers: batch }),
              },
            ),
            signed = await signedResponse.json();
          if (!signedResponse.ok)
            throw new Error(signed.error || "无法获取上传地址");
          for (const part of signed.parts) {
            setUploading(`${file.name} · ${part.partNumber}/${partCount}`);
            const chunk = file.slice(
                (part.partNumber - 1) * partSize,
                Math.min(part.partNumber * partSize, file.size),
              ),
              put = await fetch(part.url, { method: "PUT", body: chunk });
            if (!put.ok)
              throw new Error(`第 ${part.partNumber} 个分片上传失败`);
            const etag = put.headers.get("etag");
            if (!etag) throw new Error("存储服务未返回分片标识");
            completed.push({ partNumber: part.partNumber, etag });
          }
        }
        const finish = await fetch(
            `/api/files/uploads/${started.upload.id}/complete`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parts: completed }),
            },
          ),
          result = await finish.json();
        if (!finish.ok) throw new Error(result.error || "完成上传失败");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "上传失败");
        break;
      }
    }
    setUploading("");
    if (input.current) input.current.value = "";
    await load();
  }
  async function remove(file: FileItem) {
    if (!window.confirm(`将“${file.name}”移入回收站？`)) return;
    const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "删除失败");
    setSelected(null);
    await load();
  }
  const percent = data
    ? Math.min(100, (data.storage.used / data.storage.limit) * 100)
    : 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {lockedProjectId ? "项目文件" : "文件管理"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            多级目录、文件版本与工作项引用统一管理
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void createFolder()}
            className="secondary-button"
          >
            <FolderPlus size={17} />
            新建文件夹
          </button>
          <button
            disabled={!projectId || data?.storage.blocked}
            onClick={() => input.current?.click()}
            className="primary-button disabled:opacity-50"
          >
            <Upload size={17} />
            上传文件
          </button>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <input
            ref={versionInput}
            type="file"
            className="hidden"
            onChange={(event) => {
              void upload(event.target.files, versionTarget || undefined);
              setVersionTarget(null);
            }}
          />
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}
      {data && (
        <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
          <aside className="card h-fit p-4">
            <p className="px-2 text-xs font-semibold text-slate-400">
              项目与目录
            </p>
            {!lockedProjectId && (
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setFolderId(null);
                }}
                className="field mt-3"
              >
                <option value="">全部项目</option>
                {data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setFolderId(null)}
              className={`mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm ${!folderId ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Folder size={16} />
              根目录
            </button>
            <FolderTree
              folders={data.treeFolders.filter(
                (folder) => !projectId || folder.projectId === projectId,
              )}
              parentId={null}
              active={folderId}
              choose={setFolderId}
            />
            <button
              onClick={() => {
                setTrash(!trash);
                setFolderId(null);
              }}
              className={`mt-4 flex w-full items-center gap-2 border-t pt-4 text-sm ${trash ? "text-blue-600" : "text-slate-500"}`}
            >
              <Trash2 size={16} />
              回收站
            </button>
            <div className="mt-5 rounded-xl bg-slate-50 p-3">
              <div className="flex text-xs text-slate-500">
                <HardDrive size={14} className="mr-1.5" />
                存储空间
                <span className="ml-auto">
                  {formatSize(data.storage.used)} / 10 GB
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${data.storage.warning ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </aside>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-xl border bg-white px-3">
                <Search size={16} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full text-sm outline-none"
                  placeholder="搜索当前目录"
                />
              </div>
              <button onClick={() => void load()} className="secondary-button">
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
              <button
                onClick={() => setFolderId(null)}
                className="hover:text-blue-600"
              >
                {projectId
                  ? data.projects.find((project) => project.id === projectId)
                      ?.name || "项目"
                  : "全部项目"}
              </button>
              {crumbs.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <ChevronRight size={14} />
                  <button
                    onClick={() => setFolderId(folder.id)}
                    className="hover:text-blue-600"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
            {loading ? (
              <div className="grid min-h-64 place-items-center">
                <LoaderCircle className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b bg-slate-50 text-xs text-slate-400">
                        <th className="px-5 py-3 font-medium">名称</th>
                        <th className="px-4 py-3 font-medium">项目</th>
                        <th className="px-4 py-3 font-medium">大小</th>
                        <th className="px-4 py-3 font-medium">上传者</th>
                        <th className="px-4 py-3 font-medium">版本/引用</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.folders.map((folder) => (
                        <tr
                          key={folder.id}
                          onDoubleClick={() => setFolderId(folder.id)}
                          className="cursor-pointer border-b hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                                <Folder size={18} />
                              </span>
                              <b className="text-sm">{folder.name}</b>
                            </div>
                          </td>
                          <td className="px-4 text-sm text-slate-500">
                            {folder.project?.name}
                          </td>
                          <td className="px-4 text-sm text-slate-400">—</td>
                          <td className="px-4 text-sm text-slate-500">
                            {folder.creator?.name}
                          </td>
                          <td className="px-4 text-sm text-slate-400">
                            文件夹
                          </td>
                          <td />
                        </tr>
                      ))}
                      {visibleFiles.map((file) => (
                        <tr
                          key={file.id}
                          className="border-b last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <button
                              onClick={() => setSelected(file.id)}
                              className="flex items-center gap-3 text-left"
                            >
                              <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500">
                                {file.mimeType.startsWith("image/") ? (
                                  <ImageIcon size={18} />
                                ) : (
                                  <FileText size={18} />
                                )}
                              </span>
                              <span>
                                <b className="block max-w-72 truncate text-sm">
                                  {file.name}
                                </b>
                                <span className="text-xs text-slate-400">
                                  {file.mimeType}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 text-sm text-slate-500">
                            {file.project.name}
                          </td>
                          <td className="px-4 text-sm text-slate-500">
                            {formatSize(file.size)}
                          </td>
                          <td className="px-4 text-sm text-slate-500">
                            {file.creator?.name || "历史数据"}
                          </td>
                          <td className="px-4 text-sm text-slate-500">
                            V{file.currentVersion?.version || 0} ·{" "}
                            {file._count.links} 处引用
                          </td>
                          <td className="px-4">
                            <button
                              onClick={() => setSelected(file.id)}
                              className="text-slate-400"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.folders.length && !visibleFiles.length && (
                    <div className="p-14 text-center text-sm text-slate-400">
                      当前目录为空
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {uploading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <LoaderCircle className="animate-spin" size={17} />
          {uploading}
        </div>
      )}
      {selected && (
        <FileDrawer
          fileId={selected}
          close={() => setSelected(null)}
          reload={load}
          uploadVersion={(fileId) => {
            setVersionTarget(fileId);
            versionInput.current?.click();
          }}
          remove={remove}
        />
      )}
    </div>
  );
}

function FolderTree({
  folders,
  parentId,
  active,
  choose,
}: {
  folders: FolderItem[];
  parentId: string | null;
  active: string | null;
  choose: (id: string) => void;
}) {
  return (
    <div className={parentId ? "ml-4 border-l pl-2" : ""}>
      {folders
        .filter((folder) => folder.parentId === parentId)
        .map((folder) => (
          <div key={folder.id}>
            <button
              onClick={() => choose(folder.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${active === folder.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <Folder size={14} />
              <span className="truncate">{folder.name}</span>
            </button>
            <FolderTree
              folders={folders}
              parentId={folder.id}
              active={active}
              choose={choose}
            />
          </div>
        ))}
    </div>
  );
}

function FileDrawer({
  fileId,
  close,
  reload,
  uploadVersion,
  remove,
}: {
  fileId: string;
  close: () => void;
  reload: () => Promise<void>;
  uploadVersion: (id: string) => void;
  remove: (file: FileItem) => Promise<void>;
}) {
  const [detail, setDetail] = useState<{
      file: FileItem & {
        versions: Array<{
          id: string;
          version: number;
          size: number;
          createdAt: string;
          uploader: { name: string };
        }>;
        shares: Array<{
          id: string;
          expiresAt: string;
          downloads: number;
          maxDownloads: number | null;
        }>;
      };
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/files/${fileId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setDetail(body);
      })
      .catch((cause) => setError(cause.message));
  }, [fileId]);
  async function download() {
    const response = await fetch(`/api/files/${fileId}/download`),
      body = await response.json();
    if (!response.ok) return setError(body.error);
    window.location.assign(body.url);
  }
  async function share() {
    const days = Number(window.prompt("分享有效天数（1-30）", "7"));
    if (!days) return;
    const code = window.prompt("提取码（可留空）") || undefined,
      response = await fetch(`/api/files/${fileId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: days, code, maxDownloads: null }),
      }),
      body = await response.json();
    if (!response.ok) return setError(body.error);
    await navigator.clipboard.writeText(body.share.url);
    window.alert("分享链接已复制");
  }
  if (error)
    return (
      <Drawer close={close}>
        <div className="text-sm text-rose-600">{error}</div>
      </Drawer>
    );
  if (!detail)
    return (
      <Drawer close={close}>
        <LoaderCircle className="animate-spin text-blue-600" />
      </Drawer>
    );
  const file = detail.file;
  return (
    <Drawer close={close}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <File size={21} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{file.name}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {formatSize(file.size)} · {file.mimeType}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <button
          onClick={() => void download()}
          className="secondary-button justify-center"
        >
          <Download size={16} />
          下载
        </button>
        <button
          onClick={() => uploadVersion(file.id)}
          className="secondary-button justify-center"
        >
          <Upload size={16} />
          新版本
        </button>
        <button
          onClick={() => void share()}
          className="secondary-button justify-center"
        >
          <Share2 size={16} />
          分享
        </button>
      </div>
      <section className="mt-6">
        <h4 className="text-sm font-semibold">版本历史</h4>
        <div className="mt-3 space-y-2">
          {file.versions.map((version) => (
            <div key={version.id} className="rounded-xl border p-3">
              <div className="flex">
                <b className="text-sm">V{version.version}</b>
                <span className="ml-auto text-xs text-slate-400">
                  {formatSize(version.size)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {version.uploader.name} ·{" "}
                {new Date(version.createdAt).toLocaleString("zh-CN")}
              </p>
              {file.currentVersion?.version !== version.version && (
                <button
                  onClick={async () => {
                    await fetch(
                      `/api/files/${file.id}/versions/${version.id}/restore`,
                      { method: "POST" },
                    );
                    await reload();
                    close();
                  }}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600"
                >
                  <ArchiveRestore size={13} />
                  恢复为当前版本
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h4 className="text-sm font-semibold">引用与分享</h4>
        <p className="mt-2 text-sm text-slate-500">
          <Link2 className="mr-1 inline" size={14} />
          {file._count.links} 处工作项引用 · {file.shares.length} 个有效分享
        </p>
      </section>
      {file.deletedAt ? (
        <div className="mt-8 flex gap-4">
          <button onClick={async()=>{await fetch(`/api/files/${file.id}/restore`,{method:"POST"});await reload();close()}} className="flex items-center gap-2 text-sm text-blue-600"><ArchiveRestore size={16}/>恢复文件</button>
          <button onClick={async()=>{if(!window.confirm("永久删除后无法恢复，确认继续？"))return;const response=await fetch(`/api/files/${file.id}?permanent=1`,{method:"DELETE"});const body=await response.json();if(!response.ok)return setError(body.error);await reload();close()}} className="flex items-center gap-2 text-sm text-rose-600"><Trash2 size={16}/>永久删除</button>
        </div>
      ) : (
        <button onClick={() => void remove(file)} className="mt-8 flex items-center gap-2 text-sm text-rose-600"><Trash2 size={16}/>移入回收站</button>
      )}
    </Drawer>
  );
}
function Drawer({
  children,
  close,
}: {
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <>
      <button
        aria-label="关闭详情"
        onClick={close}
        className="fixed inset-0 z-40 bg-slate-950/20"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-5 top-5 text-slate-400"
        >
          <X size={20} />
        </button>
        {children}
      </aside>
    </>
  );
}
function formatSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}
