import { Composition } from 'remotion';
import { VIDEO } from '../kit/theme';
import { ProjectVideo, type ProjectVideoProps } from '../video/ProjectVideo';
import { totalFrames } from '../video/project';
import sample from '../../projects/sample.json';

import { COMPOSITION_ID } from './composition-id';

export const RemotionRoot = () => (
  <Composition
    id={COMPOSITION_ID}
    component={ProjectVideo}
    width={VIDEO.width}
    height={VIDEO.height}
    fps={VIDEO.fps}
    durationInFrames={totalFrames(sample as ProjectVideoProps['project'])}
    defaultProps={{ project: sample as ProjectVideoProps['project'] }}
    calculateMetadata={({ props }: { props: ProjectVideoProps }) => ({ durationInFrames: totalFrames(props.project) })}
  />
);
