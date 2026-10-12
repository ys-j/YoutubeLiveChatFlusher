// Loads the project's ambient type declarations into Deno's type graph so that
// the source modules imported by these tests resolve their custom types.
//
// Under the former tsc build this was handled by jsconfig.json's
// `"include": ["src/**/*", "types/*"]`. Deno has no equivalent config key, so
// importing these `.d.ts` files here is what makes `LiveChat.*`, the DOM
// augmentations, and the extension types available while type-checking.

import '../types/ytlivechatrenderer.d.ts';
import '../types/extends.d.ts';
import '../types/messaging.d.ts';
import '../types/ml_engine.d.ts';
