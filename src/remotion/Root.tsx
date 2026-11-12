import { Composition } from 'remotion';
import { VIDEO } from '../kit/theme';
import { ProjectVideo, type ProjectVideoProps } from '../video/ProjectVideo';
import { totalFrames } from '../video/project';
import sampleJson from '../../projects/sample.json';
import { projectSchema } from '../video/project';

const sample = projectSchema.parse(sampleJson);

import { COMPOSITION_ID } from './composition-id';

export const RemotionRoot = () => (
  <Composition
    id={COMPOSITION_ID}
    component={ProjectVideo}
    width={VIDEO.width}
    height={VIDEO.height}
    fps={VIDEO.fps}
    durationInFrames={totalFrames(sample)}
    defaultProps={{ project: sample }}
    calculateMetadata={({ props }: { props: ProjectVideoProps }) => ({ durationInFrames: totalFrames(props.project) })}
  />
);
