

// ==UserScript==
// @name         Chzzk P2P Bypass (AdGuard / Whale)
// @version      2025-09-11
// @author       cyberpsycho
// @match        https://chzzk.naver.com/*
// @match        https://*.chzzk.naver.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // 실제로 페이지의 JS 컨텍스트에 코드를 삽입하기 위해 <script>로 주입합니다.
  const pageScript = function() {
    'use strict';
    const NAME = 'Chzzk Bypass';
    const VER = '2025-09-11';
    console.info(`[${NAME}] injected into page context — v${VER}`);
    window.__CHZZK_BYPASS = { installed: true, version: VER };

    function modifyDataObject(data) {
      try {
        if (!data || !data.content) return data;

        // p2pQuality 제거
        if (data.content.p2pQuality) {
          console.log(`[${NAME}] Removing p2pQuality`);
          data.content.p2pQuality = [];
          try { Object.defineProperty(data.content, "p2pQuality", { configurable: false, writable: false }); } catch(e){}
        }

        // livePlaybackJson 내부 수정
        if (data.content && data.content.livePlaybackJson) {
          let playback = null;
          try {
            playback = typeof data.content.livePlaybackJson === 'string'
                       ? JSON.parse(data.content.livePlaybackJson)
                       : data.content.livePlaybackJson;
          } catch(e) { playback = null; }

          if (playback) {
            if (playback.meta && playback.meta.p2p) {
              playback.meta.p2p = false;
              console.log(`[${NAME}] Disabled playback.meta.p2p`);
            }

            if (Array.isArray(playback.media)) {
              playback.media.forEach(m => {
                if (Array.isArray(m.encodingTrack)) {
                  m.encodingTrack.forEach(track => {
                    if (track.p2pPath) {
                      delete track.p2pPath;
                      console.log(`[${NAME}] removed p2pPath (track: ${track.name || 'unknown'})`);
                    }
                    if (track.p2pPathUrlEncoding) delete track.p2pPathUrlEncoding;
                  });
                }
              });
            }

            data.content.livePlaybackJson = JSON.stringify(playback);
          }
        }
      } catch (err) {
        console.error(`[${NAME}] modifyDataObject error:`, err);
      }
      return data;
    }

    // 1) fetch 패치
    try {
      const _fetch = window.fetch.bind(window);
      window.fetch = function(input, init) {
        const url = (typeof input === 'string') ? input : (input && input.url) || '';
        return _fetch(input, init).then(async resp => {
          try {
            if (url && url.includes('live-detail')) {
              const clone = resp.clone();
              const text = await clone.text();
              let data = JSON.parse(text);
              data = modifyDataObject(data);
              const headers = new Headers(resp.headers);
              if (!headers.has('content-type')) headers.set('content-type', 'application/json;charset=utf-8');
              return new Response(JSON.stringify(data), {
                status: resp.status,
                statusText: resp.statusText,
                headers: headers
              });
            }
          } catch (err) {
            console.error(`[${NAME}] fetch patch error:`, err);
          }
          return resp;
        });
      };
      console.log(`[${NAME}] fetch patched`);
    } catch (e) {
      console.warn(`[${NAME}] fetch patch failed`, e);
    }

    // 2) XMLHttpRequest 패치 (많이 쓰는 케이스 대비)
    try {
      const proto = XMLHttpRequest.prototype;
      const origOpen = proto.open;
      const origSend = proto.send;

      proto.open = function(method, url) {
        this.__chzzk_url = url;
        return origOpen.apply(this, arguments);
      };

      proto.send = function(body) {
        // readystatechange로 응답을 가로채서 수정 시도
        this.addEventListener('readystatechange', function() {
          try {
            if (this.readyState === 4 && this.__chzzk_url && this.__chzzk_url.includes('live-detail')) {
              try {
                let text = this.responseText;
                let data = JSON.parse(text);
                data = modifyDataObject(data);
                // 가능하면 인스턴스에 getter로 덮어쓰기 (많은 브라우저에서 동작)
                try {
                  Object.defineProperty(this, 'responseText', { get: () => JSON.stringify(data) });
                  Object.defineProperty(this, 'response', { get: () => JSON.stringify(data) });
                  // also for responseXML if needed - leave alone generally
                } catch (e) {
                  // 만약 정의 실패하면 보조 필드로 저장 (일부 코드가 직접 this._chzzk_modified_response를 확인하게 만들 수 있음)
                  this._chzzk_modified_response = JSON.stringify(data);
                }
                console.log(`[${NAME}] XHR response patched for`, this.__chzzk_url);
              } catch (err) {
                console.error(`[${NAME}] XHR JSON/modify error:`, err);
              }
            }
          } catch (err) {
            console.error(`[${NAME}] XHR readyState handler error:`, err);
          }
        });
        return origSend.apply(this, arguments);
      };

      console.log(`[${NAME}] XHR patched`);
    } catch (e) {
      console.warn(`[${NAME}] XHR patch failed`, e);
    }
  }; // end pageScript

  // inject into page context
  const el = document.createElement('script');
  el.textContent = '(' + pageScript.toString() + ')();';
  (document.head || document.documentElement || document.body || document).appendChild(el);
  el.parentNode && el.parentNode.removeChild(el);

})();
