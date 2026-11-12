import { Composition } from 'remotion';
import { VIDEO } from '../kit/theme';
import { ProjectVideo, type ProjectVideoProps } from '../video/ProjectVideo';
import { VERTICAL, VerticalVideo } from '../video/VerticalVideo';
import { projectSchema, totalFrames } from '../video/project';
import sampleJson from '../../projects/sample.json';
import { COMPOSITION_ID, VERTICAL_COMPOSITION_ID } from './composition-id';

const sample = projectSchema.parse(sampleJson);
const metadata = ({ props }: { props: ProjectVideoProps }) => ({ durationInFrames: totalFrames(props.project) });

export const RemotionRoot = () => (
  <>
    {/* 横長(16:9)。1080p はこれを 1.5 倍の解像度で書き出す */}
    <Composition
      id={COMPOSITION_ID}
      component={ProjectVideo}
      width={VIDEO.width}
      height={VIDEO.height}
      fps={VIDEO.fps}
      durationInFrames={totalFrames(sample)}
      defaultProps={{ project: sample }}
      calculateMetadata={metadata}
    />
    {/* 縦長(9:16、ショート動画向け) */}
    <Composition
      id={VERTICAL_COMPOSITION_ID}
      component={VerticalVideo}
      width={VERTICAL.width}
      height={VERTICAL.height}
      fps={VIDEO.fps}
      durationInFrames={totalFrames(sample)}
      defaultProps={{ project: sample }}
      calculateMetadata={metadata}
    />
  </>
);
