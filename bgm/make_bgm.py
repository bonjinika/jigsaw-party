"""Renders three seamless-looping BGM tracks for the jigsaw game.

Each loop is rendered circularly (note tails and reverb wrap around to the start),
then written with 1 s of the loop's end before it and 1 s of its start after it,
so the page can loop between 1.0 s and 1.0 s + L with no gap, whatever padding
the mp3 encoder adds.
"""
import json
import subprocess
import sys

import numpy as np

SR = 44100
rng = np.random.default_rng(3)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Mix:
    def __init__(self, seconds):
        self.n = int(round(seconds * SR))
        self.buf = np.zeros((2, self.n))
        self.send = np.zeros((2, self.n))  # reverb send

    def add(self, sig, t, pan=0.0, gain=1.0, rev=0.25):
        """Add a mono signal at time t (seconds), wrapping around the loop."""
        start = int(round(t * SR)) % self.n
        L = np.cos((pan + 1) * np.pi / 4) * gain
        R = np.sin((pan + 1) * np.pi / 4) * gain
        pos = 0
        while pos < len(sig):
            s0 = (start + pos) % self.n
            k = min(len(sig) - pos, self.n - s0)
            seg = sig[pos:pos + k]
            self.buf[0, s0:s0 + k] += seg * L
            self.buf[1, s0:s0 + k] += seg * R
            if rev:
                self.send[0, s0:s0 + k] += seg * L * rev
                self.send[1, s0:s0 + k] += seg * R * rev
            pos += k

    def add_stereo(self, st, gain=1.0, rev=0.0):
        self.buf += st * gain
        if rev:
            self.send += st * gain * rev


def env_adsr(n, a, d, s, r, dur):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - dur) / r, 0, 1)
    return e * (1 - rel)


def rhodes(m, dur, vel=0.8):
    f = mtof(m)
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    tine = np.sin(2 * np.pi * f * t) + 0.22 * np.exp(-t * 3) * np.sin(2 * np.pi * 2 * f * t)
    tine += 0.07 * np.exp(-t * 7) * np.sin(2 * np.pi * 3 * f * t)
    bark = 0.12 * vel * np.exp(-t * 28) * np.sin(2 * np.pi * 7.01 * f * t)
    e = np.exp(-t / 1.6) * np.clip(t / 0.004, 0, 1) * (1 - np.clip((t - dur) / 0.35, 0, 1))
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.3 * t)
    return (tine + bark) * e * trem * vel * 0.22


def pad(m, dur, bright=1400):
    f = mtof(m)
    n = int((dur + 1.6) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for c in (-7, 0, 6):
        ff = f * 2 ** (c / 1200)
        ph = (ff * t + rng.random()) % 1.0
        sig += 2 * ph - 1
    sig = lowpass_fft(sig, bright)
    e = np.clip(t / 0.9, 0, 1) * (1 - np.clip((t - dur) / 1.5, 0, 1))
    return sig * e * 0.045


def musicbox(m, dur=1.5, vel=0.8):
    f = mtof(m)
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.exp(-t * 4) * np.sin(2 * np.pi * 3.01 * f * t)
    sig += 0.1 * np.exp(-t * 9) * np.sin(2 * np.pi * 5.43 * f * t)
    e = np.exp(-t / 0.9) * np.clip(t / 0.002, 0, 1)
    return sig * e * vel * 0.32


def marimba(m, vel=0.8):
    f = mtof(m)
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.28)
    sig += 0.35 * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t / 0.06)
    sig += 0.08 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t / 0.02)
    return sig * np.clip(t / 0.002, 0, 1) * vel * 0.3


def bass(m, dur, vel=0.8):
    f = mtof(m)
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) + 0.05 * np.sin(2 * np.pi * 3 * f * t)
    e = np.clip(t / 0.006, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.25)) * (1 - np.clip((t - dur) / 0.08, 0, 1))
    return sig * e * vel * 0.19


def kick(vel=0.8):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    fr = 44 + 80 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.sin(ph) * np.exp(-t / 0.16) * vel * 0.36


def hat(vel=0.5, decay=0.03):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    s = highpass_fft(rng.standard_normal(n), 5500)
    return s * np.exp(-t / decay) * vel * 0.24


def rim(vel=0.6):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    s = bandpass_fft(rng.standard_normal(n), 1400, 5200) * np.exp(-t / 0.06) * 0.35
    s += np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.03) * 0.4
    return s * vel * 0.5


def _fft_filter(x, fn):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * fn(fr), len(x))


def lowpass_fft(x, fc):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** 4))


def highpass_fft(x, fc):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4))


def bandpass_fft(x, lo, hi):
    return highpass_fft(lowpass_fft(x, hi), lo)


def waves(n, level=1.0, cycles=(7, 11)):
    """Circular ocean-wash noise: filtered noise with slow swells that repeat exactly over the loop."""
    out = np.zeros((2, n))
    t = np.arange(n) / n
    for ch in range(2):
        noise = lowpass_fft(rng.standard_normal(n), 700)
        noise = highpass_fft(noise, 90)
        swell = 0.25
        for k, c in enumerate(cycles):
            swell = swell + 0.5 * np.clip(np.sin(2 * np.pi * (c * t + 0.23 * ch + 0.4 * k)), 0, 1) ** 2
        out[ch] = noise * swell
    out /= np.abs(out).max()
    return out * 0.06 * level


def reverb_ir(seconds=2.6, predelay=0.02):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        noise = rng.standard_normal(n)
        noise = lowpass_fft(noise, 5000)
        ir[ch] = noise * np.exp(-t / (seconds / 6.5))
    ir[:, : int(predelay * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return ir


def finish(mix, name, meta, lofi=None, rev_level=0.9):
    ir = reverb_ir()
    wet = np.zeros_like(mix.buf)
    for ch in range(2):
        irp = np.zeros(mix.n)
        irp[: ir.shape[1]] = ir[ch]
        wet[ch] = np.fft.irfft(np.fft.rfft(mix.send[ch]) * np.fft.rfft(irp), mix.n)  # circular
    out = mix.buf + wet * rev_level
    if lofi:
        out = np.vstack([lowpass_fft(out[0], lofi), lowpass_fft(out[1], lofi)])
    out = np.tanh(out * 1.6) / 1.6
    out *= 0.86 / np.abs(out).max()
    pad = SR  # one second each side
    padded = np.concatenate([out[:, -pad:], out, out[:, :pad]], axis=1)
    pcm = (padded.T * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
         "-c:a", "libmp3lame", "-b:a", "128k", f"out/{name}.mp3"],
        input=pcm, check=True)
    meta[name] = {"loopStart": 1.0, "loopEnd": round(1.0 + mix.n / SR, 4)}
    print(name, round(mix.n / SR, 2), "s")


# ---------------------------------------------------------------- track 1
def track_room(meta):
    bpm = 78
    beat = 60 / bpm
    bars = 24
    mix = Mix(bars * 4 * beat)
    swing = 0.16 * beat

    def at(bar, b):
        frac = b % 1
        off = swing if abs(frac - 0.5) < 1e-6 else 0
        return (bar * 4 + b) * beat + off

    chords = {  # voicings (Rhodes, bass root)
        "Fmaj7": ([53, 57, 60, 64], 41), "Em7": ([52, 55, 59, 62], 40),
        "Dm7": ([50, 53, 57, 60], 38), "Cmaj7": ([48, 52, 55, 59], 36),
    }
    prog = ["Fmaj7", "Em7", "Dm7", "Cmaj7"]
    melody = [
        [(0, 81, 1), (1, 79, 0.5), (1.5, 76, 1.5), (3.5, 72, 0.5)],
        [(0, 74, 1), (1, 76, 0.5), (1.5, 79, 2.5)],
        [(0, 77, 1), (1, 76, 0.5), (1.5, 74, 1), (2.5, 72, 0.5), (3, 69, 1)],
        [(0, 76, 3)],
        [(0, 81, 0.5), (0.5, 84, 1), (1.5, 81, 0.5), (2, 79, 1), (3, 76, 1)],
        [(0, 79, 1.5), (1.5, 76, 0.5), (2, 74, 2)],
        [(0, 72, 0.5), (0.5, 74, 0.5), (1, 77, 1), (2, 81, 1), (3, 79, 1)],
        [(0, 76, 2), (2, 74, 0.5), (2.5, 72, 1.5)],
    ]
    for bar in range(bars):
        name = prog[bar % 4]
        notes, root = chords[name]
        sec = bar // 8
        for b, d, v in [(0, 1.4, 0.75), (1.5, 1.0, 0.55), (3, 0.9, 0.5)]:
            for k, m in enumerate(notes):
                mix.add(rhodes(m, d * beat, v), at(bar, b) + k * 0.012, pan=-0.3 + 0.2 * k, gain=0.9, rev=0.35)
        mix.add(bass(root, 1.6 * beat), at(bar, 0), gain=1.0, rev=0.05)
        mix.add(bass(root + 7, 0.8 * beat, 0.6), at(bar, 2.5), gain=1.0, rev=0.05)
        if sec == 2:
            for m in notes:
                mix.add(pad(m + 12, 4 * beat), at(bar, 0), pan=0.0, gain=0.9, rev=0.6)
        if sec < 2:
            mix.add(kick(0.8), at(bar, 0), rev=0.02)
            mix.add(kick(0.55), at(bar, 2.5), rev=0.02)
            mix.add(rim(0.55), at(bar, 1), pan=0.1, rev=0.2)
            mix.add(rim(0.55), at(bar, 3), pan=0.1, rev=0.2)
        for h in range(8):
            mix.add(hat(0.55 if h % 2 == 0 else 0.35), at(bar, h * 0.5), pan=0.35, rev=0.05)
        if sec == 1:
            for b, m, d in melody[bar % 8]:
                mix.add(musicbox(m, d * beat, 0.7), at(bar, b), pan=-0.15, gain=0.9, rev=0.45)
    mix.add_stereo(waves(mix.n, 0.8, cycles=(6, 9)), rev=0.0)
    # a little vinyl dust
    dust = np.zeros(mix.n)
    pos = rng.integers(0, mix.n, 260)
    dust[pos] = rng.uniform(-1, 1, len(pos))
    dust = highpass_fft(dust, 2500) * 0.06
    mix.add_stereo(np.vstack([dust, np.roll(dust, 331)]))
    finish(mix, "bgm1", meta, lofi=9500)


# ---------------------------------------------------------------- track 2
def track_nap(meta):
    bpm = 62
    beat = 60 / bpm
    bars = 16
    mix = Mix(bars * 4 * beat)
    chords = [  # two bars each
        ([50, 54, 57, 61, 64], 38), ([47, 50, 54, 57, 61], 35),
        ([43, 47, 50, 54, 57], 31), ([45, 50, 52, 54, 57], 33),
    ]
    r = np.random.default_rng(11)
    for i in range(bars // 2):
        notes, root = chords[i % 4]
        t0 = i * 8 * beat
        for m in notes[:4]:
            mix.add(pad(m, 8 * beat, 1100), t0, gain=1.2, rev=0.7)
        mix.add(bass(root, 6 * beat, 0.5), t0, gain=0.8, rev=0.2)
        for k, m in enumerate(notes[1:]):
            mix.add(rhodes(m + 12, 2.5 * beat, 0.35), t0 + (k * 0.75) * beat, pan=-0.4 + 0.25 * k, gain=0.8, rev=0.6)
        tones = [m + 24 for m in notes] + [notes[0] + 36]
        prev = None
        for s in range(8):
            if r.random() < 0.72:
                m = int(r.choice([x for x in tones if x != prev]))
                prev = m
                mix.add(musicbox(m, 1.5, 0.45 + 0.25 * r.random()), t0 + s * beat + (0.5 * beat if r.random() < 0.3 else 0),
                        pan=float(r.uniform(-0.5, 0.5)), rev=0.8)
    mix.add_stereo(waves(mix.n, 2.2, cycles=(5, 8)))
    finish(mix, "bgm2", meta, lofi=10000, rev_level=1.1)


# ---------------------------------------------------------------- track 3
def track_puzzle(meta):
    bpm = 100
    beat = 60 / bpm
    prog = ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C", "Dm", "Am", "Bb", "F", "Gm7", "C", "F", "F"]
    triads = {"F": [53, 57, 60], "C": [48, 52, 55], "Dm": [50, 53, 57], "Bb": [46, 50, 53],
              "Am": [45, 48, 52], "Gm7": [43, 46, 50, 53]}
    roots = {"F": 41, "C": 36, "Dm": 38, "Bb": 34, "Am": 33, "Gm7": 31}
    melody = [
        [(0, 84, .5), (.5, 81, .5), (1, 84, 1), (2, 81, .5), (2.5, 79, .5), (3, 77, 1)],
        [(0, 79, 1), (1, 76, .5), (1.5, 79, .5), (2, 84, 2)],
        [(0, 81, .5), (.5, 77, .5), (1, 81, 1), (2, 86, 1), (3, 84, 1)],
        [(0, 82, 1.5), (1.5, 81, .5), (2, 79, 2)],
        [(0, 81, .5), (.5, 84, .5), (1, 89, 1), (2, 84, 1), (3, 81, 1)],
        [(0, 79, .5), (.5, 81, .5), (1, 79, 1), (2, 76, 1), (3, 72, 1)],
        [(0, 74, 1), (1, 77, .5), (1.5, 82, 1.5), (3, 81, 1)],
        [(0, 79, 3)],
        [(0, 77, 1), (1, 81, 1), (2, 86, 1.5), (3.5, 84, .5)],
        [(0, 84, 1), (1, 81, 1), (2, 76, 2)],
        [(0, 86, 1), (1, 84, .5), (1.5, 82, .5), (2, 81, 1), (3, 79, 1)],
        [(0, 81, 2), (2, 77, 2)],
        [(0, 82, 1), (1, 81, .5), (1.5, 79, .5), (2, 77, 1), (3, 74, 1)],
        [(0, 76, 1), (1, 79, 1), (2, 84, 1), (3, 82, 1)],
        [(0, 81, 3), (3, 84, 1)],
        [(0, 81, 1.5), (1.5, 79, .5), (2, 77, 2)],
    ]
    bars = 32
    mix = Mix(bars * 4 * beat)
    for bar in range(bars):
        name = prog[bar % 16]
        tri = triads[name]
        seq = [tri[0] + 12, tri[1] + 12, tri[2] + 12, tri[0] + 24, tri[2] + 12, tri[1] + 12, tri[2] + 12, tri[0] + 24]
        for s, m in enumerate(seq):
            mix.add(marimba(m, 0.75 if s % 2 == 0 else 0.5), (bar * 4 + s * 0.5) * beat,
                    pan=0.3 if s % 2 else -0.2, rev=0.3)
        root = roots[name]
        for b, m, d in [(0, root, 0.9), (1.5, root, 0.4), (2, root + 7, 0.9), (3.5, root + 12, 0.4)]:
            mix.add(bass(m, d * beat, 0.8), (bar * 4 + b) * beat, rev=0.05)
        mix.add(kick(0.7), (bar * 4) * beat, rev=0.02)
        mix.add(kick(0.55), (bar * 4 + 2) * beat, rev=0.02)
        mix.add(rim(0.5), (bar * 4 + 1) * beat, pan=-0.1, rev=0.25)
        mix.add(rim(0.5), (bar * 4 + 3) * beat, pan=-0.1, rev=0.25)
        for h in range(8):
            mix.add(hat(0.45 if h % 2 else 0.3, 0.025), (bar * 4 + h * 0.5) * beat, pan=0.4, rev=0.05)
        for m in tri:
            mix.add(pad(m + 12, 4 * beat, 1800), bar * 4 * beat, gain=0.55, rev=0.5)
        if bar >= 16:
            for b, m, d in melody[bar % 16]:
                mix.add(musicbox(m, d * beat, 0.75), (bar * 4 + b) * beat, pan=0.05, gain=1.0, rev=0.35)
    finish(mix, "bgm3", meta, lofi=12000, rev_level=0.7)


if __name__ == "__main__":
    meta = {}
    which = sys.argv[1:] or ["1", "2", "3"]
    if "1" in which: track_room(meta)
    if "2" in which: track_nap(meta)
    if "3" in which: track_puzzle(meta)
    print(json.dumps(meta))
