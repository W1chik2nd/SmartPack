// 一个停靠点卡片:配图 + 类型 + 名称 + 时间 + 备注。
//
// 配图由卡片自己去补:后端 /api/itinerary/photo/<stopId> 第一次查图库、
// 之后走库里缓存。放在卡片里而不是在页面级一次性查完,是为了让行程页秒开 ——
// 图库慢或限流只影响单张图,不拖累整页(AGENTS.md §3:检索逻辑在后端,
// 这里只负责触发和展示)。
import { useEffect, useState } from "react";
import { stopPhoto, type StopPhoto, type TripStop } from "../api";
import { useLang } from "../i18n/useLang";
import type { StringKey } from "../i18n/strings";

const KIND_LABEL: Record<TripStop["kind"], StringKey> = {
  spot: "stopSpot",
  transit: "stopTransit",
  meal: "stopMeal",
  hotel: "stopHotel",
};

type Props = {
  stop: TripStop;
  /** 挂在竖线的哪一侧。 */
  side: "left" | "right";
  /** 显式指定网格行,避免自动排布把左右两列挤进同一行。 */
  row: number;
};

export default function StopCard({ stop, side, row }: Props) {
  const { lang, t } = useLang();
  // 后端已经存过图就直接用,省一次请求。
  const [photo, setPhoto] = useState<StopPhoto | null>(
    stop.photoUrl
      ? {
          imageUrl: stop.photoUrl,
          credit: stop.photoCredit ?? "",
          sourceUrl: stop.photoSourceUrl ?? "",
        }
      : null
  );
  const [pending, setPending] = useState(!stop.photoUrl && Boolean(stop.photoQuery));

  useEffect(() => {
    if (photo || !stop.photoQuery) return;
    let alive = true;
    stopPhoto(stop.id)
      .then(({ photo }) => {
        if (!alive) return;
        setPhoto(photo);
        setPending(false);
      })
      .catch(() => {
        // 配图缺失不是错误状态:占位块就是最终形态。
        if (alive) setPending(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per stop
  }, [stop.id]);

  const name = lang === "zh" ? stop.name : stop.nameEn || stop.name;
  const note = lang === "zh" ? stop.note : stop.noteEn || stop.note;
  const timing = [stop.startTime, stop.duration].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      className={`stop-card side-${side}`}
      style={{ gridRow: row }}
    >
      <span className="stop-photo">
        {photo ? (
          <img
            src={photo.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="stop-photo-empty">
            {pending ? t("photoPending") : t("photoNone")}
          </span>
        )}
      </span>

      <span className="stop-body">
        <span className="stop-kind">
          <span
            className={`stop-kind-mark ${stop.kind}`}
            aria-hidden="true"
          />
          {t(KIND_LABEL[stop.kind])}
        </span>
        <span className="stop-name">{name}</span>
        {timing && <span className="stop-time">{timing}</span>}
        {note && <span className="stop-note">{note}</span>}
        {photo?.credit && (
          <span className="stop-credit">{photo.credit}</span>
        )}
      </span>
    </button>
  );
}
