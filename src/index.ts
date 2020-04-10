import domReady from "domready";
import { chunk, sum } from "lodash-es";
import easing from "bezier-easing";

domReady(async () => {
  const WAVE_LEFT = 8;
  const WAVE_BOTTOM = 8;
  const WAVE_HEIGHT = 128;
  const WAVE_WIDTH = 4;
  const WAVE_MARGIN = 4;
  const WAVE_MAX_WIDTH = 480;
  const CHUNK_SIZE = 8;
  const DEVICEID =
    "9b0c320fedc88fedc0a9ce12dab9f49d654aa982a8708c002a606f70c42bce57";

  const c = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = c.getContext("2d");

  const devs = await navigator.mediaDevices.enumerateDevices();
  const dev = devs.filter(d => d.label === "Soundflower (2ch)")[0];
  console.log("using", dev);

  const media = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: dev.deviceId }
  });

  const actx = new AudioContext({ sampleRate: 48000 });
  const devin = actx.createMediaStreamSource(media);

  const gain = actx.createGain();
  gain.gain.setValueAtTime(200, 0);

  const eq = actx.createBiquadFilter();
  eq.type = "lowpass";
  eq.frequency.setValueAtTime(1000, 0);

  const eq2 = actx.createBiquadFilter();
  eq2.type = "highpass";
  eq2.frequency.setValueAtTime(200, 0);

  const comp = actx.createDynamicsCompressor();
  comp.attack.setValueAtTime(0, 0);
  comp.threshold.setValueAtTime(-50, 0);
  comp.ratio.setValueAtTime(20, 0);

  const analyzer = actx.createAnalyser();
  analyzer.smoothingTimeConstant = 0.4;
  analyzer.fftSize = 8192;

  devin.connect(gain);
  gain.connect(comp);
  comp.connect(eq);
  eq.connect(eq2);

  eq2.connect(analyzer);
  eq2.connect(actx.destination);

  const buf = new Uint8Array(analyzer.frequencyBinCount);
  const samplePosEasing = easing(0.13, 0.02, 1, 1);
  const samplingEase = easing(0.51, 0.04, 0.5, 0.9);
  const heightEasing = easing(0.49, 0.02, 0.44, 0.97);

  const sampling = (idx: number, array: number[]) => {
    const normIdx = Math.round(idx);
    const rate = samplingEase(Math.abs(normIdx - idx));

    if (normIdx + 1 in array) {
      const diff = array[normIdx + 1] - array[normIdx];
      return array[normIdx] + diff * rate;
    } else {
      return array[normIdx];
    }
  };

  const render = () => {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = WAVE_WIDTH;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    analyzer.getByteFrequencyData(buf);

    const samples = chunk(buf, CHUNK_SIZE).map(nums => sum(nums));

    for (let idx = 0, l = samples.length; idx < l; idx++) {
      const left = WAVE_LEFT + idx * (WAVE_WIDTH + WAVE_MARGIN);
      if (left > WAVE_MAX_WIDTH) break;

      const normSample = sampling(
        samples.length * samplePosEasing(idx / samples.length),
        samples
      );

      const height = heightEasing(normSample / (255 * CHUNK_SIZE));

      ctx.beginPath();
      ctx.moveTo(left, c.height - WAVE_BOTTOM);
      ctx.lineTo(left, c.height - WAVE_BOTTOM - WAVE_HEIGHT * height);
      ctx.closePath();
      ctx.stroke();
    }

    requestAnimationFrame(render);
  };

  window.addEventListener("resize", () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  });

  window.dispatchEvent(new Event("resize"));

  requestAnimationFrame(render);
});
