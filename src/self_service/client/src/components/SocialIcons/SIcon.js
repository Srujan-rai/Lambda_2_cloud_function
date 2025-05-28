import React from 'react';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import IconButton from '@material-ui/core/IconButton';

import { Add, Remove } from '@material-ui/icons';
import { VInput, VFile } from '../Commons';

/** OneIcon wrapper */
const SIcon = ({ rowData, handlers }) => {
    const { idx } = rowData;
    const urlValue = rowData.btnLink || "";
    const fileValue = rowData.fileUrl || rowData.imgSrc || "";
    const fieldData = {
        url: {
            name: "url" + idx,
            value: urlValue,
            placeholder: rowData.placeholder,
            error: rowData.error || ""
        },
        file: {
            // label: "Enter File",
            name: "sicon" + idx,
            value: fileValue
        }
    };
    return (
        <List>
            <ListItem>
                <ListItemText>
                    <div style={{ float: "left", marginRight: "50px", width: "50%" }}>
                        <VInput
                            fieldData={fieldData.url}
                            handleOnChange={handlers.onChange(idx)}
                        />
                    </div>

                    <div style={{ float: "left", width: "40%" }}>
                        <VFile
                            fieldData={fieldData.file}
                            handleOnChange={handlers.onFile(idx)}
                        />
                    </div>
                </ListItemText>
                <ListItemSecondaryAction>
                    <IconButton aria-label="Add" onClick={handlers.onRow(idx)} style={{ margin: "0px" }}>
                        {
                            (idx === 0) ?
                                <Add /> :
                                <Remove />
                        }
                    </IconButton>
                </ListItemSecondaryAction>
            </ListItem>
        </List>
    )
};

SIcon.propTypes = {};

export {
    SIcon
};