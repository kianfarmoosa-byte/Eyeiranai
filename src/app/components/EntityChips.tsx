import { useMemo } from "react";
import { Article } from "../data";
import { entitiesForArticle, entityKindColor, entityKindLabel } from "../entities";
import { toFa } from "./mobile/utils/fa";

type Props = {
  article: Article;
  max?: number;
  onClickEntity?: (text: string) => void;
};

export function EntityChips({ article, max = 12, onClickEntity }: Props) {
  const entities = useMemo(() => entitiesForArticle(article), [article]);
  if (!entities.length) return null;
  const top = entities.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5 my-3">
      {top.map((e, i) => (
        <button
          key={`${e.kind}-${e.text}-${i}`}
          onClick={() => onClickEntity?.(e.text)}
          className={`px-2 py-0.5 rounded-full text-[11px] ${entityKindColor(e.kind)} hover:opacity-80`}
          title={`${entityKindLabel(e.kind)} • ${toFa(e.count)} بار`}
        >
          {e.text}
          {e.count > 1 && <span className="opacity-60 mr-1">×{toFa(e.count)}</span>}
        </button>
      ))}
    </div>
  );
}
