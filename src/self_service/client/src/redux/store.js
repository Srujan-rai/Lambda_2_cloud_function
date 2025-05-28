import { createStore, applyMiddleware, compose } from 'redux';
import createSagaMiddleware from 'redux-saga';
import rootReducer from './rootReducer';
import rootSaga from './sagas';
import { loadState, saveState } from './storage';
import throttle from 'lodash/throttle';

const initializeStore = () => {
    const sagaMiddleware = createSagaMiddleware();
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    const persistedState = loadState();
    const store = createStore(
        rootReducer,
        persistedState,
        composeEnhancers(
            applyMiddleware(
                sagaMiddleware
            )
        )
    );

    store.subscribe(throttle(() => {
        saveState(store.getState());
    }, 1000));

    sagaMiddleware.run(rootSaga);
    return store;
};

export default initializeStore;