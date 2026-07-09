# @aleup/import

## 0.1.1

### Patch Changes

- a449245: Fix "Plugin was nullish" crash under React StrictMode. `useUppyImport` destroyed its Uppy instance synchronously in the unmount cleanup, so StrictMode's dev double-mount (setup → cleanup → setup on the same memoized instance) left the live instance destroyed — every `uppy.getPlugin()` then returned null, crashing the Companion OAuth popup callback (and silently masking as "not connected" on the initial probe). Teardown is now deferred a macrotask so a StrictMode re-mount cancels it, while a genuine unmount (or a deps-change instance swap) still tears down.
