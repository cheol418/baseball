"use client";

/**
 * 못 찾은 주소.
 *
 * **예전 링크를 살리는 자리이기도 하다.** 정적 번들로 바꾸면서
 * `/play/[id]`가 `/play/?id=`로 옮겨가(미리 만들 페이지가 없으므로),
 * 그 전에 저장해 둔 링크가 전부 404가 됐다 (실제로 겪음).
 *
 * 서버 리다이렉트를 쓰지 않는다 — `vercel.json`에 적으면 웹에서는 돌지만
 * **앱 웹뷰에서는 그 설정이 없다.** 404 화면이 직접 길을 찾아주면
 * 두 곳에서 똑같이 돈다.
 */

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { AppBar, Column, Container } from "@/components/ui";

/** `/play/<id>` · `/play/<id>/` → 세이브 id */
const legacyPlayId = (path: string): string | null => {
  const m = /^\/play\/([^/?#]+)\/?$/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
};

/** 마운트됐는가 — 이 프로젝트가 브라우저 값을 렌더에 쓸 때의 방식 그대로 */
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export default function NotFound() {
  /*
   * 주소는 **마운트된 뒤에** 읽는다. 렌더 중에 `location`을 보면
   * 서버가 만든 404.html과 값이 달라 hydration이 깨진다.
   *
   * effect 안에서 `setState`를 부르지 않는다 — 연쇄 렌더가 된다.
   * 마운트 여부만 받아 **렌더 중에 계산**하고, effect는 옮기기만 한다.
   */
  const mounted = useSyncExternalStore(subscribe, onClient, onServer);
  const legacy = mounted ? legacyPlayId(window.location.pathname) : null;
  const moving = legacy !== null;

  useEffect(() => {
    if (legacy === null) return;
    window.location.replace(`/play/?id=${encodeURIComponent(legacy)}`);
  }, [legacy]);

  return (
    <Container>
      <AppBar title={moving ? "이동 중" : "찾을 수 없습니다"} back="/" />
      <Column>
        <div className="card mt-6 px-5 py-8 text-center">
          <div className="text-[40px] leading-none">{moving ? "🧭" : "⚾"}</div>
          <div className="mt-2 text-[17px] font-black">
            {moving ? "선수를 찾아가는 중입니다" : "없는 주소입니다"}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            {moving
              ? "주소 형식이 바뀌어 새 주소로 옮기고 있습니다."
              : "주소가 바뀌었거나 지워진 페이지입니다.\n저장된 선수는 홈에서 그대로 열 수 있습니다."}
          </p>
          {!moving && (
            <Link href="/" className="btn btn-primary mt-5 w-full py-3 text-[14px]">
              홈으로
            </Link>
          )}
        </div>
      </Column>
    </Container>
  );
}
