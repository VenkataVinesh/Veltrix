import os
import re

hook_pattern = re.compile(
    r'\b(useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer|'
    r'useQuery|useMutation|useRouter|useWebSocket|useRealtimeStore|useAppStore|'
    r'useRealtimeChannel|useKeyboardShortcuts|useInView|useMotionValue|useSpring)\b'
)
client_pattern = re.compile(r"""^['"]use client['"]""")

missing = []
scan_dirs = ['components', 'app', 'lib']

for base in scan_dirs:
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in [
            'node_modules', '.next', '__pycache__', 'dist', 'build'
        ]]
        for f in files:
            if not f.endswith(('.tsx', '.ts')):
                continue
            # Skip pure type/util files
            if f.endswith('.d.ts'):
                continue
            path = os.path.join(root, f)
            with open(path, encoding='utf-8', errors='ignore') as fh:
                content = fh.read()
                lines = content.splitlines()
            first = lines[0].strip() if lines else ''
            has_directive = client_pattern.match(first) is not None
            has_hooks = bool(hook_pattern.search(content))
            if has_hooks and not has_directive:
                # Exclude pure hook definition files that export only functions
                # (they themselves don't need 'use client' unless called at module level)
                missing.append(path)

for p in sorted(missing):
    print('MISSING:', p)
print(f'\nTotal: {len(missing)}')
