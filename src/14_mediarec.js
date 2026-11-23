/* ============================================================
   LyricWave — fast export (M1 v0.24.0): realtime MediaRecorder capture.
   Records the preview canvas + the preview audio while the song plays,
   the way SonaWave's videoExporter.ts does (canvas.captureStream +
   MediaStreamAudioDestination). Unlike SonaWave, the file is NEVER
   mislabelled: the extension and the reported codec always come from
   the recorder's ACTUAL mimeType.
   User-visible strings live in 12_ui.js (FAST_ERR / fastProg) because
   only 12_ui.js goes through the i18n pass — this file throws error
   CODES (e.fastCode) instead of messages.
   ============================================================ */
(() => {
'use strict';

/* mime candidates, best first (SonaWave's list: hardware H.264+AAC first) */
const FAST_MIME_CANDS = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=h264,aac',
  'video/mp4;codecs=h264,opus',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
J.pickFastMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of FAST_MIME_CANDS) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return null;
};
J.fastExportSupported = () => !!J.pickFastMime();
/* describe a mime for the user: { container, video, audio, label } */
J.fastMimeInfo = (mime) => {
  const m = String(mime || '');
  const container = /mp4/i.test(m) ? 'MP4' : /webm/i.test(m) ? 'WebM' : '?';
  const video = /avc1|h264/i.test(m) ? 'H.264' : /vp9/i.test(m) ? 'VP9' : /vp8/i.test(m) ? 'VP8' : null;
  const audio = /mp4a|aac/i.test(m) ? 'AAC' : /opus/i.test(m) ? 'Opus' : null;
  return { container, video, audio, label: container + (video ? ' ' + video : '') + (audio ? ' + ' + audio : '') };
};
J.fastFileExt = (mime) => /mp4/i.test(String(mime || '')) ? 'mp4' : 'webm';
J.fastVideoBitrate = (quality) => quality === 'max' ? 24e6 : quality === 'standard' ? 8e6 : 14e6;

const fastErr = (code) => { const e = new Error(code); e.fastCode = code; return e; };

/* Realtime export: play the preview from t0 and record it.
   The caller (runExport in 12_ui.js) owns the progress UI, the wake lock
   and the AbortController; it also sets S.exporting so the Cancel button works.
   M4 v0.29.0: `playlist` (optional) records a whole playlist with ONE recorder:
   { total, count, advance } — when a song ends, `advance(i)` (the caller's
   switchTrack + play) moves to song i and returns { duration } (null on
   failure). The picture may freeze for a few frames at a song boundary
   (realtime capture); the offline export is the frame-exact one.
   Returns { blob, mime, info, audio, audioWanted, width, height, duration, wallMs }. */
J.exportFast = async ({ plan, project, audio, range, onProgress, signal, playlist }) => {
  if (typeof MediaRecorder === 'undefined') throw fastErr('no-recorder');
  const view = document.getElementById('view');
  if (!view || !plan) throw fastErr('no-view');
  const mime = J.pickFastMime();
  if (!mime) throw fastErr('no-mime');
  const span = J.exportSpan(plan, range);
  const t0 = span.t0, dur = span.dur;
  const totalDur = playlist && playlist.total > 0 ? playlist.total : dur;
  const trackCount = playlist && playlist.count > 1 ? playlist.count : 1;
  const [w, h] = J.outputSize(project);
  const fps = plan.fps;
  const ui = J.ui, api = J.uiApi;
  // the preview canvas records at the chosen output size (restored afterwards)
  const oldW = view.width, oldH = view.height;
  const oldLoop = ui.loop;
  let rec = null, canvasStream = null;
  const chunks = [];
  let state = 'run', failErr = null;
  const restore = () => {
    ui.fastExporting = false; ui.loop = oldLoop;
    try { view.width = oldW; view.height = oldH; } catch (e) {}
    ui.need = true;
    try { api.pause(); } catch (e) {}
  };
  try {
    ui.loop = 'off';
    ui.fastExporting = true;
    view.width = w; view.height = h;
    // audio tap first: AP wires the export branch before play() starts the source
    let audioStream = null;
    const wantAudio = !!(audio && audio.buffer && project.includeAudio !== false);
    if (wantAudio && api.audioStream) { try { audioStream = api.audioStream(); } catch (e) { audioStream = null; } }
    api.seek(t0);
    api.play();
    canvasStream = view.captureStream(fps);
    const vTracks = canvasStream.getVideoTracks();
    if (!vTracks.length) throw fastErr('no-video');
    const combined = new MediaStream();
    vTracks.forEach(t => combined.addTrack(t));
    let audioTracked = false;
    if (audioStream) audioStream.getAudioTracks().forEach(t => { if (t.readyState === 'live') { combined.addTrack(t); audioTracked = true; } });
    rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: J.fastVideoBitrate(project.quality || 'high'), audioBitsPerSecond: 320000 });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { rec.onstop = resolve; rec.onerror = () => resolve(); });
    const tStart = performance.now();
    let maxT = ui.t, lastAdvance = Date.now();
    let trackIdx = 0, trackT0 = t0, trackDur = dur, elapsedBefore = 0, advancing = false;
    const stallMs = trackCount > 1 ? 10000 : 3000;   // a song switch (reload + decode) may take seconds
    rec.start(250);
    onProgress && onProgress(0);
    await new Promise((resolve) => {
      const watch = setInterval(() => {
        if (advancing) return;   // a song switch is in flight; wait for it
        const t = ui.t;
        if (t > maxT + 0.001) { maxT = t; lastAdvance = Date.now(); }
        onProgress && onProgress(Math.min(1, Math.max(0, (elapsedBefore + Math.max(0, maxT - trackT0)) / totalDur)));
        if (signal && signal.aborted) { state = 'abort'; clearInterval(watch); resolve(); return; }
        const atEnd = maxT >= trackT0 + trackDur - 0.02 || !ui.playing;
        if (atEnd) {
          if (trackIdx + 1 < trackCount && playlist && playlist.advance) {
            advancing = true;
            const nextIdx = trackIdx + 1;
            Promise.resolve()
              .then(() => playlist.advance(nextIdx))
              .then(next => {
                if (!next || !(next.duration > 0)) { state = 'fail'; failErr = fastErr('advance-failed'); clearInterval(watch); resolve(); return; }
                elapsedBefore += trackDur;
                trackIdx = nextIdx; trackDur = next.duration; trackT0 = 0; maxT = 0;
                lastAdvance = Date.now();
                advancing = false;
              })
              .catch(() => { state = 'fail'; failErr = fastErr('advance-failed'); clearInterval(watch); resolve(); });
            return;
          }
          state = 'done'; clearInterval(watch); resolve(); return;
        }
        if (Date.now() - lastAdvance > stallMs) { state = 'fail'; failErr = fastErr('stalled'); clearInterval(watch); resolve(); return; }
        // M4: the wall clock is the wrong ruler for a playlist on a slow
        // machine — realtime playback itself runs slower than song time
        // there (the M1 slow-clock limit), so a playlist gets 3x song time
        // + 30 s for the song switches. The stall detector above still
        // catches a genuinely stuck export. Single songs keep M1's bound.
        const timeoutMs = trackCount > 1 ? (totalDur * 3 + 30) * 1000 : (totalDur * 1.5 + 10) * 1000;
        if (performance.now() - tStart > timeoutMs) { state = 'fail'; failErr = fastErr('timeout'); clearInterval(watch); resolve(); return; }
      }, 100);
    });
    if (rec.state !== 'inactive') { try { rec.requestData(); } catch (e) {} rec.stop(); await stopped; }
    if (state === 'abort') throw fastErr('cancelled');
    if (state === 'fail') throw failErr;
    if (!chunks.length) throw fastErr('no-chunks');
    const actualMime = (rec && rec.mimeType) || mime;
    const blob = new Blob(chunks, { type: actualMime });
    const wallMs = performance.now() - tStart;
    restore();
    return { blob, mime: actualMime, info: J.fastMimeInfo(actualMime), audio: audioTracked, audioWanted: wantAudio, width: w, height: h, duration: totalDur, wallMs };
  } catch (e) {
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e2) {}
    restore();
    throw e;
  } finally {
    try { if (canvasStream) canvasStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); } catch (e) {}
  }
};
})();
