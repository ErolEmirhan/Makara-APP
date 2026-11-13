#!/usr/bin/env python3
"""Makara brag soundtrack: one piece, one grid (100 BPM, beat = 0.6 s), D minor -> D major.

Music and effects are written together: impacts are pitched to the chord root, ticks and
bells use the scale, whooshes sit low in the mix. Output: 48 kHz stereo 16-bit WAV.
"""
import sys, wave, zlib
import numpy as np

SR = 48000
DUR = 23.4
BEAT = 0.6
N = int(round(DUR * SR)) + SR  # one extra second of room for tails (trimmed at the end)
rng = np.random.default_rng(7)

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# note names -> midi
NOTE = {}
for octv in range(0, 8):
    for name, pc in [('C', 0), ('C#', 1), ('Db', 1), ('D', 2), ('Eb', 3), ('E', 4), ('F', 5), ('F#', 6), ('Gb', 6),
                     ('G', 7), ('Ab', 8), ('A', 9), ('Bb', 10), ('B', 11)]:
        NOTE[f'{name}{octv}'] = 12 * (octv + 1) + pc
def f(n):
    return mtof(NOTE[n])

class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)
    def add(self, sig, t0, gain=1.0, pan=0.0):
        i0 = int(round(t0 * SR))
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[-i0:]; i0 = 0
        sig = sig[: N - i0]
        a = (pan + 1) * np.pi / 4  # constant power
        self.L[i0:i0 + len(sig)] += sig * gain * np.cos(a)
        self.R[i0:i0 + len(sig)] += sig * gain * np.sin(a)
    def addst(self, L, R, t0, gain=1.0):
        i0 = int(round(t0 * SR))
        n = min(len(L), N - i0)
        self.L[i0:i0 + n] += L[:n] * gain
        self.R[i0:i0 + n] += R[:n] * gain

def tt(d):
    return np.arange(int(round(d * SR))) / SR

def env_adsr(n, a, d, s, r, total):
    """Linear attack, exponential decay to sustain, linear release; durations in seconds."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel_start = total - r
    e = np.where(t > rel_start, e * np.clip(1 - (t - rel_start) / max(r, 1e-4), 0, 1), e)
    return e

def saw_additive(freq, dur, bright=2600.0, detune_cents=(0.0,), phase_seed=0):
    """Band-limited, spectrally tilted saw via a one-cycle wavetable (fast, alias-free)."""
    n = int(round(dur * SR))
    out = np.zeros(n)
    r = np.random.default_rng(phase_seed)
    TS = 4096
    ph_tab = np.arange(TS) / TS
    for dc in detune_cents:
        f0 = freq * 2 ** (dc / 1200)
        nh = int(max(1, min(64, 7500 / f0)))
        tab = np.zeros(TS)
        for h in range(1, nh + 1):
            tab += (1.0 / h) * np.exp(-h * f0 / bright) * np.sin(2 * np.pi * h * ph_tab + r.uniform(0, 2 * np.pi))
        idx = ((r.uniform() + f0 * np.arange(n) / SR) % 1.0) * TS
        i0 = idx.astype(np.int64)
        fr = idx - i0
        out += tab[i0 % TS] * (1 - fr) + tab[(i0 + 1) % TS] * fr
    return out / len(detune_cents)

# ---------------------------------------------------------------- instruments
def pad(bus, notes, t0, t1, gain=0.05, attack=0.5, release=0.7, bright=1800.0, swell=False):
    dur = t1 - t0 + release
    n = int(round(dur * SR))
    for k, nm in enumerate(notes):
        fr = f(nm)
        for side, cents in ((-0.55, (-9.0, 3.0)), (0.55, (-3.0, 9.0))):
            s = saw_additive(fr, dur, bright, cents, phase_seed=zlib.crc32(f'{nm}{side}{t0}'.encode()))
            e = env_adsr(n, attack, 1.0, 1.0, release, dur)
            if swell:
                e = e * (0.35 + 0.65 * np.clip(np.arange(n) / SR / (t1 - t0), 0, 1))
            bus.add(s * e, t0, gain / np.sqrt(len(notes)), pan=side * (0.4 + 0.15 * (k % 3)))

def sub(bus, note, t0, t1, gain=0.22, attack=0.25, release=0.5):
    dur = t1 - t0 + release
    t = tt(dur)
    fr = f(note)
    s = np.sin(2 * np.pi * fr * t) + 0.18 * np.sin(2 * np.pi * 2 * fr * t) + 0.05 * np.sin(2 * np.pi * 3 * fr * t)
    bus.add(s * env_adsr(len(t), attack, 1, 1, release, dur), t0, gain)

def pluck(bus, note, t0, gain=0.06, decay=0.22, bright=2200.0, pan=0.0):
    dur = decay * 5
    s = saw_additive(f(note), dur, bright, (0.0, 6.0), phase_seed=int(t0 * 1000) & 0xffff)
    t = tt(dur)
    e = np.minimum(t / 0.004, 1) * np.exp(-t / decay)
    bus.add(s * e, t0, gain, pan)

def bell(bus, note, t0, gain=0.07, length=1.6, pan=0.0):
    """Celesta / music-box: harmonic partials with fast high decay, soft attack click removed."""
    t = tt(length)
    fr = f(note)
    parts = [(1, 1.0, length * .55), (2, .32, length * .28), (3, .12, length * .16), (4.02, .06, length * .1), (5.98, .025, length * .06)]
    s = np.zeros_like(t)
    for mult, amp, dec in parts:
        s += amp * np.sin(2 * np.pi * fr * mult * t) * np.exp(-t / dec)
    s *= np.minimum(t / 0.003, 1)
    bus.add(s, t0, gain, pan)

def kick(bus, t0, gain=0.5, f_hi=115.0, f_lo=44.0, decay=0.32):
    t = tt(decay * 4)
    freq = f_lo + (f_hi - f_lo) * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    s = np.sin(ph) * np.exp(-t / decay)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.0025) * 0.08
    bus.add(np.tanh(1.4 * (s + click)), t0, gain)

def tom(bus, t0, root_hz, gain=0.32, decay=0.34, pan=0.0):
    t = tt(decay * 4)
    freq = root_hz * (1 + 0.7 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    s = np.sin(ph) * np.exp(-t / decay) + 0.25 * np.sin(2 * ph) * np.exp(-t / (decay * .5))
    nz = lowpass_fft(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.05) * 0.35
    bus.add(np.tanh(1.2 * (s + nz)), t0, gain, pan)

def boom(bus, t0, root_hz, gain=0.75, decay=2.2):
    """Trailer impact pitched to the chord root: sub drop + body + low noise burst."""
    t = tt(decay * 2.2)
    freq = root_hz * (1 + 1.6 * np.exp(-t / 0.07))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    s = np.sin(ph) * np.exp(-t / decay)
    s += 0.35 * np.sin(2 * ph) * np.exp(-t / (decay * .4))
    nz = lowpass_fft(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.18) * 0.9
    s = np.tanh(1.6 * (s + nz))
    bus.add(s, t0, gain)

def snare_hit(bus, t0, gain=0.12, decay=0.11, pan=0.0):
    t = tt(decay * 4)
    nz = bandpass_fft(rng.standard_normal(len(t)), 900, 7000) * np.exp(-t / decay)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    bus.add(nz + body, t0, gain, pan)

def tick(bus, note, t0, gain=0.045, pan=0.0):
    t = tt(0.12)
    s = np.sin(2 * np.pi * f(note) * t) * np.exp(-t / 0.018) + 0.3 * np.sin(2 * np.pi * f(note) * 3 * t) * np.exp(-t / 0.008)
    bus.add(s, t0, gain, pan)

def riser(bus, t0, t1, gain=0.16, f_from=280.0, f_to=9000.0, tone_from=None, tone_to=None):
    dur = t1 - t0
    n = int(round(dur * SR))
    x = rng.standard_normal(n)
    prog = np.linspace(0, 1, n)
    cut = f_from * (f_to / f_from) ** (prog ** 1.6)
    y = timevarying_lowpass(x, cut)
    e = prog ** 2.2
    L = y * e
    R = timevarying_lowpass(rng.standard_normal(n), cut) * e
    if tone_from:
        fr = tone_from * (tone_to / tone_from) ** prog
        ph = 2 * np.pi * np.cumsum(fr) / SR
        tone = (np.sin(ph) + 0.5 * np.sin(2 * ph)) * e * 0.35
        L += tone; R += tone
    bus.addst(L, R, t0, gain)

def whoosh(bus, t0, dur=0.55, gain=0.08, f_from=400.0, f_to=3500.0, pan_from=-0.7, pan_to=0.7):
    n = int(round(dur * SR))
    prog = np.linspace(0, 1, n)
    cut = f_from * (f_to / f_from) ** np.sin(prog * np.pi / 2)
    y = timevarying_lowpass(rng.standard_normal(n), cut)
    e = np.sin(np.pi * prog) ** 1.5
    pan = pan_from + (pan_to - pan_from) * prog
    a = (pan + 1) * np.pi / 4
    bus.addst(y * e * np.cos(a), y * e * np.sin(a), t0, gain)

# ---------------------------------------------------------------- dsp
def lowpass_fft(x, fc):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fr / fc) ** 4)
    return np.fft.irfft(X, len(x))

def bandpass_fft(x, lo, hi):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / np.sqrt(1 + (lo / np.maximum(fr, 1)) ** 4)) * (1 / np.sqrt(1 + (fr / hi) ** 4))
    return np.fft.irfft(X, len(x))

def highpass_fft(x, fc):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fc / np.maximum(fr, 1e-3)) ** 4)
    return np.fft.irfft(X, len(x))

def timevarying_lowpass(x, cutoffs, block=2048):
    """Overlap-add STFT lowpass whose cutoff follows `cutoffs` (per-sample array)."""
    hop = block // 4
    win = np.hanning(block)
    pad_x = np.concatenate([np.zeros(block), x, np.zeros(block)])
    out = np.zeros_like(pad_x)
    norm = np.zeros_like(pad_x)
    fr = np.fft.rfftfreq(block, 1 / SR)
    for start in range(0, len(pad_x) - block, hop):
        seg = pad_x[start:start + block] * win
        ci = min(max(start + block // 2 - block, 0), len(cutoffs) - 1)
        fc = cutoffs[ci]
        S = np.fft.rfft(seg) / np.sqrt(1 + (fr / fc) ** 4)
        out[start:start + block] += np.fft.irfft(S, block) * win
        norm[start:start + block] += win ** 2
    out = out / np.maximum(norm, 1e-6)
    return out[block:block + len(x)]

def make_ir(rt_low=2.6, rt_mid=2.1, rt_high=1.1, length=3.0, predelay=0.022):
    n = int(length * SR)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        x = rng.standard_normal(n)
        X = np.fft.rfft(x)
        fr = np.fft.rfftfreq(n, 1 / SR)
        bands = []
        for lo, hi, rt in ((0, 400, rt_low), (400, 3500, rt_mid), (3500, SR / 2, rt_high)):
            m = ((fr >= lo) & (fr < hi)).astype(float)
            b = np.fft.irfft(X * m, n) * np.exp(-6.91 * t / rt)
            bands.append(b)
        ir = sum(bands)
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])[:n]
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs

def convolve(x, ir):
    m = len(x) + len(ir) - 1
    nfft = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)
    return y[:len(x)]

def gate(bus, t0, t1, floor=0.0, fade=0.03):
    """Duck a bus between t0 and t1 (pre-hit silence)."""
    t = np.arange(N) / SR
    g = np.ones(N)
    down = np.clip((t - t0) / fade, 0, 1)
    up = np.clip((t - t1) / fade, 0, 1)
    g = 1 - (1 - floor) * down * (1 - up)
    bus.L *= g; bus.R *= g

# ---------------------------------------------------------------- score
music = Bus()   # pads, bass, strings, bells
drums = Bus()
fx = Bus()      # booms, risers, whooshes, ticks
B = lambda k: k * BEAT  # beat -> seconds

# A: 0 - 6.6  dark, Czech-street-at-night tension (D minor)
pad(music, ['D3', 'F3', 'A3'], 0.0, 3.6, gain=0.064, attack=1.2, bright=1200, swell=True)
pad(music, ['Bb2', 'D3', 'F3', 'A3'], 3.6, 5.4, gain=0.070, attack=0.35, bright=1400)
pad(music, ['A2', 'C#3', 'E3', 'A3'], 5.4, 6.45, gain=0.074, attack=0.25, bright=1700, swell=True, release=0.12)
sub(music, 'D2', 0.0, 3.6, gain=0.110, attack=1.0)
sub(music, 'Bb1', 3.6, 5.4, gain=0.121)
sub(music, 'A1', 5.4, 6.42, gain=0.121, release=0.1)
for k in range(0, 11, 2):          # heartbeat: lub-dub on beats 0,2,4,...
    t0 = B(k)
    g = 0.22 + 0.02 * k
    kick(drums, t0, gain=g, f_hi=90, f_lo=40, decay=0.30)
    kick(drums, t0 + 0.2, gain=g * 0.55, f_hi=80, f_lo=38, decay=0.22)
for k in range(4, 22):             # soft clock ticks on 8ths, crescendo
    t0 = k * BEAT / 2
    if t0 >= 6.35: break
    tick(fx, 'D6' if k % 2 == 0 else 'A5', t0, gain=0.018 + 0.002 * (k - 4), pan=0.25 if k % 2 else -0.25)
# music-box motif under the hook / texture lines
for t0, nm in [(0.9, 'A4'), (1.2, 'D5'), (1.5, 'E5'), (1.8, 'F5'), (2.4, 'E5'), (3.0, 'D5'),
               (3.9, 'D5'), (4.2, 'F5'), (4.5, 'A5'), (4.8, 'F5'), (5.4, 'E5'), (5.7, 'C#5'), (6.0, 'E5')]:
    bell(music, nm, t0, gain=0.075, length=1.4, pan=0.15)
whoosh(fx, 3.32, dur=0.62, gain=0.07, f_from=300, f_to=2600, pan_from=-0.8, pan_to=0.8)
riser(fx, 5.0, 6.56, gain=0.14, f_from=250, f_to=8000, tone_from=f('A2'), tone_to=f('A4'))

# HIT 6.6 - the sign switches on (deceptive A -> Bb: the lift)
boom(fx, 6.6, f('Bb1'), gain=0.78)
pad(music, ['Bb2', 'D3', 'F3', 'Bb3', 'D4'], 6.6, 8.4, gain=0.062, attack=0.02, bright=2600)
pad(music, ['F2', 'A2', 'C3', 'F3', 'A3', 'C4'], 8.4, 10.2, gain=0.058, attack=0.15, bright=2400)
sub(music, 'Bb1', 6.6, 8.4, gain=0.132, attack=0.01)
sub(music, 'F1', 8.4, 10.2, gain=0.132, attack=0.05)
for nm, pn in [('Bb4', -0.3), ('D5', 0.0), ('F5', 0.3), ('Bb5', 0.1)]:
    bell(music, nm, 6.6, gain=0.04, length=2.4, pan=pn)
for k in range(11, 17):            # reveal: kick on beats, 8th-note strings & bells
    kick(drums, B(k), gain=0.42 if k % 2 == 1 else 0.3)
seq_reveal = ['Bb3', 'F3', 'D4', 'F3', 'Bb3', 'F3', 'D4', 'F4', 'F3', 'C4', 'A3', 'C4', 'F3', 'C4', 'A3', 'C4']
for i, nm in enumerate(seq_reveal[2:]):
    t0 = 6.6 + (i + 2) * BEAT / 2 + 0.0
    if t0 >= 10.2: break
    pluck(music, nm, t0, gain=0.045, decay=0.18, pan=-0.35 if i % 2 else 0.35)
for i, nm in enumerate(['D5', 'F5', 'Bb5', 'F5', 'A5', 'C6', 'F5', 'A5']):
    bell(music, nm, 7.2 + i * BEAT / 2 * 1.0 + (0.6 if i >= 4 else 0), gain=0.032, length=1.2, pan=0.4 if i % 2 else -0.2)
for k, t0 in enumerate([9.6, 9.75, 9.9, 10.05]):    # tom pickup into the montage
    tom(drums, t0, f('F2'), gain=0.2 + 0.05 * k, pan=-0.3 + 0.2 * k)

# Montage 10.2 - 16.2: one chord + one impact per product (Dm, Bb, F, C, Gm)
chords = [
    (['D3', 'F3', 'A3', 'D4'], 'D2', 'D1', ['D5', 'F5', 'A5', 'F5']),
    (['Bb2', 'D3', 'F3', 'Bb3'], 'Bb1', 'Bb0', ['D5', 'F5', 'Bb5', 'F5']),
    (['F2', 'A2', 'C3', 'F3', 'A3'], 'F1', 'F1', ['C5', 'F5', 'A5', 'F5']),
    (['C3', 'E3', 'G3', 'C4'], 'C2', 'C1', ['C5', 'E5', 'G5', 'E5']),
    (['G2', 'Bb2', 'D3', 'G3'], 'G1', 'G1', ['D5', 'G5', 'Bb5', 'G5']),
]
for i, (notes, bass, root, arp) in enumerate(chords):
    st = 10.2 + i * 1.2
    pad(music, notes, st, st + 1.2, gain=0.056, attack=0.03, release=0.35, bright=2600)
    sub(music, bass, st, st + 1.2, gain=0.24, attack=0.01, release=0.2)
    boom(fx, st, mtof(NOTE[root]) * (2 if root.endswith('0') else 1), gain=0.36, decay=0.9)
    tom(drums, st, f(bass) * 2, gain=0.34)
    whoosh(fx, st - 0.18, dur=0.3, gain=0.035, f_from=600, f_to=3000, pan_from=0.6 * (-1) ** i, pan_to=-0.6 * (-1) ** i)
    for b in range(2):
        kick(drums, st + b * BEAT, gain=0.46 if b == 0 else 0.36)
        snare_hit(drums, st + b * BEAT + BEAT / 2, gain=0.05 if b == 0 else 0.07, pan=0.1)
    for j in range(4):
        pluck(music, notes[j % len(notes)], st + j * BEAT / 2, gain=0.04, decay=0.16, pan=-0.4 if j % 2 else 0.4)
        bell(music, arp[j], st + j * BEAT / 2, gain=0.03, length=1.0, pan=0.3 if j % 2 else -0.3)

# Build 16.2 - 19.2: A pedal, count-up ticks climb the scale, snare roll crescendo
pad(music, ['A2', 'D3', 'E3', 'A3'], 16.2, 17.4, gain=0.05, attack=0.2, bright=1800)
pad(music, ['A2', 'C#3', 'E3', 'A3', 'C#4'], 17.4, 19.05, gain=0.058, attack=0.15, bright=2600, swell=True, release=0.1)
sub(music, 'A1', 16.2, 19.04, gain=0.132, release=0.08)
boom(fx, 16.2, f('A1'), gain=0.32, decay=1.2)
scale = ['D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6', 'D6']
nt = 16
for i in range(nt):                 # count-up ticks, easing like the on-screen counter
    x = (i + 1) / nt
    t0 = 16.4 + (1 - (1 - x) ** (1 / 3)) * 1.0 - 1.0 / nt * 0.2
    tick(fx, scale[min(len(scale) - 1, i * len(scale) // nt)], t0, gain=0.03 + 0.002 * i, pan=-0.3 + 0.04 * i)
bell(fx, 'A5', 17.4, gain=0.07, length=1.8, pan=-0.1)    # the "+" lands
bell(fx, 'E6', 17.4, gain=0.04, length=1.4, pan=0.2)
for k in range(28):                 # 16th snare roll 16.8 -> 19.0
    t0 = 16.8 + k * BEAT / 4
    if t0 > 19.0: break
    snare_hit(drums, t0, gain=0.015 + 0.0042 * k, decay=0.08, pan=0.15 * ((-1) ** k))
for k, t0 in enumerate([18.6, 18.75, 18.9]):
    tom(drums, t0, f('A1') * 2, gain=0.24 + 0.05 * k, pan=0.3 - 0.3 * k)
riser(fx, 17.6, 19.15, gain=0.13, f_from=300, f_to=10000, tone_from=f('A3'), tone_to=f('A5'))

# HIT 19.2 - outro, home: D major (the Picardy lift into the brand)
boom(fx, 19.2, f('D1'), gain=0.8, decay=2.8)
pad(music, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'], 19.2, 22.7, gain=0.06, attack=0.03, release=1.0, bright=2200)
sub(music, 'D2', 19.2, 22.6, gain=0.121, attack=0.01, release=1.0)
for nm, pn in [('D5', -0.3), ('F#5', 0.0), ('A5', 0.3), ('D6', 0.1)]:
    bell(music, nm, 19.2, gain=0.045, length=2.6, pan=pn)
for t0, nm, ln in [(19.9, 'A5', 1.4), (20.2, 'F#5', 1.4), (20.5, 'E5', 1.4), (20.8, 'D5', 1.6),
                   (21.4, 'E5', 1.4), (21.7, 'F#5', 1.6), (22.0, 'A5', 2.4), (22.0, 'D5', 2.4)]:
    bell(music, nm, t0, gain=0.06, length=ln, pan=0.12)
pluck(music, 'D3', 19.2, gain=0.06, decay=0.6)
pluck(music, 'A3', 19.2, gain=0.05, decay=0.6, pan=0.3)

# pre-hit silences (the breath before each impact)
for bus in (music, drums):
    gate(bus, 6.42, 6.6, floor=0.0, fade=0.035)
    gate(bus, 19.06, 19.2, floor=0.0, fade=0.03)
gate(fx, 6.56, 6.6, floor=0.0, fade=0.012)
gate(fx, 19.16, 19.2, floor=0.0, fade=0.012)

# ---------------------------------------------------------------- mix
irL, irR = make_ir()
def send(bus, amt):
    return convolve(bus.L, irL) * amt, convolve(bus.R, irR) * amt

# dynamics: the intro sits lower so the 6.6 s impact lands as a real lift
ta = np.arange(N) / SR
intro = 0.84 + 0.16 * np.clip((ta - 6.5) / 0.1, 0, 1)
for bus in (music, drums):
    bus.L *= intro; bus.R *= intro
mL = music.L * 1.0 + drums.L * 0.9 + fx.L * 0.95
mR = music.R * 1.0 + drums.R * 0.9 + fx.R * 0.95
for bus, amt in ((music, 0.42), (drums, 0.16), (fx, 0.30)):
    rl, rr = send(bus, amt)
    mL += rl; mR += rr

mL = highpass_fft(mL, 30); mR = highpass_fft(mR, 30)
def low_shelf(x, fc=95.0, gain_db=-5.0):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    gl = 10 ** (gain_db / 20)
    X *= gl + (1 - gl) / (1 + (fc / np.maximum(fr, 1e-3)) ** 2)
    return np.fft.irfft(X, len(x))
def presence(x, fc=5000.0, gain_db=2.5):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    gh = 10 ** (gain_db / 20)
    X *= 1 + (gh - 1) / (1 + (fc / np.maximum(fr, 1e-3)) ** 2)
    return np.fft.irfft(X, len(x))
mL = presence(low_shelf(mL)); mR = presence(low_shelf(mR))
# gentle glue + soft clip
drive = 1.15
mL = np.tanh(mL * drive) / drive
mR = np.tanh(mR * drive) / drive
# trim to video length with a final fade
n_out = int(round(DUR * SR))
mL = mL[:n_out]; mR = mR[:n_out]
t = np.arange(n_out) / SR
fade = np.clip((DUR - t) / 0.45, 0, 1) ** 1.5
mL *= fade; mR *= fade
peak = max(np.max(np.abs(mL)), np.max(np.abs(mR)))
mL = mL / peak * 0.89; mR = mR / peak * 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
pcm = np.empty(n_out * 2)
pcm[0::2] = mL; pcm[1::2] = mR
pcm = np.clip(pcm + rng.uniform(-0.5, 0.5, len(pcm)) / 32768, -1, 1)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((pcm * 32767).astype('<i2').tobytes())
print('wrote', out, f'{DUR}s', 'peak-normalised')
