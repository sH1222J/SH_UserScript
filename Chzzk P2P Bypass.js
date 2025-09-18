// ==UserScript==

// @name         Chzzk P2P Bypass (Tampermonkey / Chrome)

// @version      2025-09-15

// @description  Disable P2P streaming for Chzzk live streams

// @author       ???

// @match        https://chzzk.naver.com/*

// @match        https://*.chzzk.naver.com/*

// @grant        none

// @run-at       document-start

// ==/UserScript==



(function() {

  'use strict';

  const NAME = 'Chzzk Bypass';

  const VER = '2025-09-15';



  console.info(`[${NAME}] running in userscript context — v${VER}`);



  function modifyDataObject(data) {

    try {

      if (!data || !data.content) return data;



      // Remove p2pQuality

      if (data.content.p2pQuality) {

        console.log(`[${NAME}] Removing p2pQuality`);

        data.content.p2pQuality = [];

        try {

          Object.defineProperty(data.content, "p2pQuality", {

            configurable: false,

            writable: false

          });

        } catch (e) {}

      }



      // Modify livePlaybackJson

      if (data.content && data.content.livePlaybackJson) {

        let playback = null;

        try {

          playback = typeof data.content.livePlaybackJson === 'string'

                     ? JSON.parse(data.content.livePlaybackJson)

                     : data.content.livePlaybackJson;

        } catch (e) {

          playback = null;

        }



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

                    console.log(`[${NAME}] Removed p2pPath`);

                  }

                  if (track.p2pPathUrlEncoding) {

                    delete track.p2pPathUrlEncoding;

                    console.log(`[${NAME}] Removed p2pPathUrlEncoding`);

                  }

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



  // Patch fetch

  (function patchFetch() {

    const _fetch = window.fetch;

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

            if (!headers.has('content-type')) {

              headers.set('content-type', 'application/json;charset=utf-8');

            }



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

  })();



  // Patch XMLHttpRequest

  (function patchXHR() {

    const proto = XMLHttpRequest.prototype;

    const origOpen = proto.open;

    const origSend = proto.send;



    proto.open = function(method, url) {

      this.__chzzk_url = url;

      return origOpen.apply(this, arguments);

    };



    proto.send = function(body) {

      this.addEventListener('readystatechange', function() {

        if (this.readyState === 4 && this.__chzzk_url && this.__chzzk_url.includes('live-detail')) {

          try {

            let data = JSON.parse(this.responseText);

            data = modifyDataObject(data);



            Object.defineProperty(this, 'responseText', { get: () => JSON.stringify(data) });

            Object.defineProperty(this, 'response', { get: () => JSON.stringify(data) });



            console.log(`[${NAME}] XHR response patched for`, this.__chzzk_url);

          } catch (err) {

            console.error(`[${NAME}] XHR patch error:`, err);

          }

        }

      });

      return origSend.apply(this, arguments);

    };

    console.log(`[${NAME}] XHR patched`);

  })();

})();

