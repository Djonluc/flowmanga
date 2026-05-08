const atob = (v) => Buffer.from(v, 'base64').toString('binary');
const btoa = (v) => Buffer.from(v, 'binary').toString('base64');

function comixApiSignature(pathOrUrl) {
    const atobFn = (value) => atob(value);
    const btoaFn = (value) => btoa(value);
    const bytes = (value) => value.split("").map((char) => char.charCodeAt(0));
    const chars = (value) => String.fromCharCode.apply(null, value);
    const urlSafe = (value) =>
      btoaFn(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const rc4 = (key, input) => {
      const state = [];
      let j = 0;
      let out = "";
      for (let i = 0; i < 256; i++) state[i] = i;
      for (let i = 0; i < 256; i++) {
        j = (j + state[i] + key.charCodeAt(i % key.length)) % 256;
        [state[i], state[j]] = [state[j], state[i]];
      }
      let i = 0;
      j = 0;
      for (let idx = 0; idx < input.length; idx++) {
        i = (i + 1) % 256;
        j = (j + state[i]) % 256;
        [state[i], state[j]] = [state[j], state[i]];
        out += String.fromCharCode(
          input.charCodeAt(idx) ^ state[(state[i] + state[j]) % 256],
        );
      }
      return out;
    };
    const keyD = () => bytes(atobFn("DTSTmUt6LpDUw9r1lSQqyb3YlFTzruT8tk8wUGkwehQ="));
    const keyB = () => bytes(atobFn("3PordjODbhqla382Cxapmo/1JiABJQcjiJj1+48gTJ4="));
    const keyZ = () => bytes(atobFn("8i0Cru/VJBSVB2Y1GcMDVpzx2WepOcfnWdd81yxICl4="));
    const keyTe = () => bytes(atobFn("bewtiTuV+HJk56xxkf2iCljLgruCpBmN9BgE8i6gc9M="));
    const keyIe = () => bytes(atobFn("yXayUVFrrcW56jQCEfZzuCidjpnWKjTDUNT7XeX9i7k="));

    const a = (v) => 81 ^ v;
    const c = (v) => 218 ^ v;
    const m = (v) => 147 ^ v;
    const w = (v) => 37 ^ v;
    const x = (v) => 180 ^ v;
    const q = (v) => 255 & ((v >>> 1) | (v << 7));
    const vrot = (v) => 255 & ((v << 1) | (v >>> 7));
    const ne = (v) => 255 & ((v << 2) | (v >>> 6));
    const s = (v) => 255 & ((v << 7) | (v >>> 1));
    const L = (v) => 255 & ((v >>> 4) | (v << 4));
    const y = (v) => 255 & ((v << 4) | (v >>> 4));
    const R = (v) => (v + 159) % 256;
    const u = (v) => (v - 159 + 256) % 256;
    const X = (v) => (v + 34) % 256;
    const O = (v) => (v - 34 + 256) % 256;

    const wrap = (key, input) => bytes(rc4(atobFn(key), chars(input)));
    const M = (input) => wrap("JxTcdyiA5GZxnbrmthXBQfU2IMTKcY1+3nNhbq98Sgo=", input);
    const ae = (input) => wrap("MHNBHYWA7lvy867fXgvGcJwWDk79KqUJUVFsh3RwnnI=", input);
    const g = (input) => wrap("B46L1x+UeWP+19cRpQ+OZvdLAK9EHID8g3mSgn57tew=", input);
    const p = (input) => wrap("7xWfIF5THL5LAnRgAARg+4mjWHPU9n3PQwvzbaMNi+Q=", input);
    const P = (input) => wrap("WgeCQ3T8R51uTwVSiVa7Zy0dN6JOg6Z5JleMS+HV8Aw=", input);

    const C = (input) => {
      const key = keyB();
      const prefix = atobFn("OaKvnI5ARA==");
      const out = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 7) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = s(n); break;
          case 1: n = w(n); break;
          case 2: n = a(n); break;
          case 3: n = m(n); break;
          case 4: n = ne(n); break;
          case 5:
          case 8: n = y(n); break;
          case 6: n = c(n); break;
          case 7: n = u(n); break;
          case 9: n = x(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const H = (input) => {
      const key = keyZ();
      const prefix = atobFn("Fyskubz8VvA=");
      const out = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 9: n = x(n); break;
          case 1: n = vrot(n); break;
          case 2: n = m(n); break;
          case 3: n = s(n); break;
          case 4: n = ne(n); break;
          case 5: n = y(n); break;
          case 6:
          case 8: n = R(n); break;
          case 7: n = X(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const I = (input) => {
      const key = keyD();
      const prefix = atobFn("vY/meeI=");
      const out = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = a(n); break;
          case 1: n = y(n); break;
          case 2:
          case 9: n = L(n); break;
          case 3: n = w(n); break;
          case 4: n = u(n); break;
          case 5: n = q(n); break;
          case 6: n = x(n); break;
          case 7: n = O(n); break;
          case 8: n = ne(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const T = (input) => {
      const key = keyTe();
      const prefix = atobFn("/Xcb2zAu8AU=");
      const out = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 7: n = c(n); break;
          case 1:
          case 4: n = vrot(n); break;
          case 2: n = q(n); break;
          case 3: n = R(n); break;
          case 5:
          case 8: n = x(n); break;
          case 6: n = m(n); break;
          case 9: n = w(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const oe = (input) => {
      const key = keyIe();
      const prefix = atobFn("tSLco2w=");
      const out = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = L(n); break;
          case 1:
          case 3: n = m(n); break;
          case 2: n = X(n); break;
          case 4:
          case 9: n = c(n); break;
          case 5:
          case 7: n = vrot(n); break;
          case 6: n = x(n); break;
          case 8: n = ne(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };

    const path = pathOrUrl
      .replace(/^https?:\/\/[^/]+/, "")
      .split("?")[0]
      .replace(/^\/api\/v1/, "");
    
    console.log('Path for signature:', path);
    let out = bytes(encodeURIComponent(path));
    out = C(out);
    out = M(out);
    out = H(out);
    out = ae(out);
    out = I(out);
    out = g(out);
    out = T(out);
    out = p(out);
    out = oe(out);
    out = P(out);
    return urlSafe(chars(out));
}

console.log('Result:', comixApiSignature('/api/v1/manga/wv5rr/chapters'));
