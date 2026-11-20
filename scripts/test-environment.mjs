export function fixtureEnvironment(extra = {}) {
  const inherited = Object.fromEntries(["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "CI"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
  return { ...inherited, LC_ALL: "C", ...extra, NODE_ENV: "test", EXA_RESEARCH_ENABLED: "false" };
}
