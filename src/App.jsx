import '@reshuffle/code-transform/macro';
import React, { Component } from 'react';
import { Route, Switch, withRouter } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import { AuthContext } from '@reshuffle/react-auth';
import DevSite from './containers/DevSite';
import Auth from './containers/Auth';
import Editor from './containers/Editor';
import Admin from './containers/Admin';

class App extends Component {
  static contextType = AuthContext;

  render() {
    // If the route is an auth or admin route, display it if user is right REACT_APP_VALID_HOSTED_DOMAIN .
    // Otherwise, defer to the DevSite nested routing

    return (
      <Switch>
        <PrivateRoute exact path='/editor' component={Editor} />
        <PrivateRoute path='/admin' component={Admin} />
        <Route path='/auth' render={props => <Auth {...props} />} />

        <Route component={DevSite} props={this.props} />
      </Switch>
    );
  }
}

export default withRouter(App);
