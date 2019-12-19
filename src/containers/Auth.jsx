import '@reshuffle/code-transform/macro';
import React from 'react';
import { useAuth } from '@reshuffle/react-auth';
import '../style/Auth.scss';
import get from 'lodash.get';

export default props => {
  const { getLoginURL } = useAuth();
  const path = get(props, 'location.state.path', '/editor')

  return (
    <div className='auth'>
      <a
        href={getLoginURL(`${window.location.origin.toString()}${path}`)}
        className='auth-button'
      >
        Click here to authenticate with Reshuffle Identity
      </a>
    </div>
  );
}
