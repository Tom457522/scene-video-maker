/** 効果音(項目が出るときの小さな音)のファイル。projects/assets/ からの相対パス */
export const SFX_FILE = 'audio/sfx-pop.wav';

type SoundProject = { scenes: { audio?: unknown }[]; settings?: { bgm?: string } };

/** 音のあるプロジェクトか(書き出しで音を入れるか決める) */
export const hasSound = (project: SoundProject): boolean => project.scenes.some((s) => s.audio) || (project.settings?.bgm ?? '') !== '';
