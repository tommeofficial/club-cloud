// Finds kicks in the incoming audio on the audio thread, so none are missed however slowly the page is drawing.
import { OnsetDetector } from './beattrack.js?v=3';
class Onset extends AudioWorkletProcessor {
  constructor() { super(); this.det = new OnsetDetector(sampleRate); }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const at = currentTime + i / sampleRate;
      if (this.det.step(ch[i], at)) this.port.postMessage({ at });
    }
    return true;
  }
}
registerProcessor('onset', Onset);
