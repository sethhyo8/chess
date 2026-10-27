# Corresponding Stockfish source

`stockfishjs-17.1-source.tar.gz` contains unmodified source and build scripts from
https://github.com/nmrugg/stockfish.js/commit/602fd7e1a571a2be71f242942db90483731f2a1f
(the npm `stockfish@17.1.0` gitHead). Generated `src/stockfish*.js` and `.wasm`
outputs have been omitted; their source, Emscripten glue, Makefiles, GPL licence,
authors, network download scripts and tests are included. Archive SHA-256:

```
3e13ca0a2f1507ce96741af803df6446aee70a6c91d87a7efebe0eac50102f53
```

For the installed lite single-threaded build use upstream's `build.js --lite
--single-threaded --no-split` with its specified Emscripten toolchain. Its network
is `nn-9067e33176e8.nnue`, embedded in the installed WASM. The runtime does not
need a separate NNUE file. If rebuilding, obtain the named NNUE through an
authoritative Stockfish source and verify its SHA-256 starts with `9067e33176e8`;
keep TLS verification on. The included upstream download script has a historical
curl `-k` fallback; do not use that fallback. Build reproduction has not been
performed in this workspace; the npm-distributed build is the one tested.

Preserve this source, attribution and licence information when redistributing the
engine. See the project README and `public/licences/stockfish-GPL3.txt`.
