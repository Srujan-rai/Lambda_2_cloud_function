import React, { Component } from 'react';
import { List } from '@material-ui/core';
import { SIcon } from './SIcon';

/** SIcon wrapper */
class SocialIcons extends Component {
    renderSIcon = (val, idx) => {
        const { onAdd, onDelete, onChange, onFile } = this.props.iconsOnChange();

        return (
            <SIcon
                key={idx}
                rowData={{
                    ...val,
                    idx
                }}
                handlers={{
                    onChange,
                    onFile,
                    onRow: (idx === 0) ?
                        onAdd : onDelete
                }}
            />
        )
    }

    render() {
        const { icons } = this.props;
        return (
            <List>
                {icons && icons.map(this.renderSIcon)}
            </List>
        )
    }
}

SocialIcons.propTypes = {};

export {
    SocialIcons
};