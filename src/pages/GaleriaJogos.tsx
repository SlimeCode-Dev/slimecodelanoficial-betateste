import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Trash2, PlusCircle, Gamepad2 } from "lucide-react";
import { useLMS } from "@/contexts/LMSContext";
import { useSiteContent, getYoutubeId } from "@/contexts/SiteContentContext";
import { FilePreviewModal } from "@/components/FilePreviewModal";

export default function GaleriaJogos() {
  const { currentUser } = useLMS();
  const { content, addGalleryVideo, removeGalleryVideo } = useSiteContent();
  const canEdit = currentUser?.role === "admin";

  const [active, setActive] = useState<{ title: string; videoUrl: string } | null>(null);

  const handleAdd = () => {
    const title = window.prompt("Título do jogo:");
    if (!title || !title.trim()) return;
    const description = window.prompt("Descrição:") || "";
    const videoUrl = window.prompt("Cole o link do vídeo do YouTube:") || "";
    if (!getYoutubeId(videoUrl)) {
      window.alert("Link do YouTube inválido.");
      return;
    }
    addGalleryVideo({ title: title.trim(), description, videoUrl: videoUrl.trim() });
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <Link
          to="/#blog"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-[#3ddc84]"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <header className="mt-6 mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3ddc84]/50 px-4 py-1.5 text-xs font-semibold slime-neon">
            <Gamepad2 className="h-4 w-4" /> GALERIA DE JOGOS
          </span>
          <h1 className="mt-5 text-3xl font-extrabold md:text-4xl">
            JOGOS 2D FEITOS PELA <span className="slime-neon">TURMA</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            Clique em um card para assistir ao vídeo do jogo no YouTube.
          </p>
        </header>

        {canEdit && (
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#3ddc84]/60 px-4 py-2 text-sm font-semibold text-[#3ddc84] hover:bg-[#3ddc84]/10"
            >
              <PlusCircle className="h-4 w-4" /> Adicionar jogo
            </button>
          </div>
        )}

        {content.gameGallery.length === 0 ? (
          <p className="text-center text-white/50">Nenhum jogo cadastrado ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {content.gameGallery.map((g) => {
              const id = getYoutubeId(g.videoUrl);
              const thumb = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined;
              return (
                <article
                  key={g.id}
                  className="slime-card group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl"
                  onClick={() => setActive({ title: g.title, videoUrl: g.videoUrl })}
                >
                  <div className="relative">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={g.title}
                        loading="lazy"
                        className="h-48 w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center bg-black/60">
                        <Gamepad2 className="h-10 w-10 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#3ddc84] text-black">
                        <Play className="h-6 w-6 fill-current" />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-bold text-white">{g.title}</h3>
                    <p className="mt-2 text-sm text-white/70">{g.description}</p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Remover este jogo?")) removeGalleryVideo(g.id);
                      }}
                      aria-label="Remover jogo"
                      className="absolute bottom-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/50 bg-black/80 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <FilePreviewModal
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        fileName={active?.title || ""}
        fileType="video"
        videoUrl={active?.videoUrl}
        title={active?.title}
      />
    </div>
  );
}
