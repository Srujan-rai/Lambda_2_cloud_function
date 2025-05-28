import React, { Component } from 'react';
import { withStyles } from '@material-ui/core';
import { Button } from '@material-ui/core';
import { Add } from '@material-ui/icons';
import PrizeImage from '../PrizeImage/PrizeImage';
import styles from "../PrizeForm/styles";
import { getSelectedLanguageCode } from "../../helpers/utils";
import { PRIZE_IMAGES_MAX } from '../../constants/forms';

class PrizeImageList extends Component {
    render() {

        const {
            classes, store, onFileItemAddition, onFileItemRemoval,
            onChangeFileUpload, onImageMetadataChange, onImageMetadataNameChange
        } = this.props;

        const selectedLanguageCode = getSelectedLanguageCode(store.selectedLanguage);

        const hasImagesMetadata = store.imagesMetadata && store.imagesMetadata[selectedLanguageCode] && store.imagesMetadata[selectedLanguageCode].length > 0;

        const withinImagesLimit = hasImagesMetadata && store.imagesMetadata[selectedLanguageCode].length < PRIZE_IMAGES_MAX;

        const prizeImageComponent =
        <div className={classes.fileUpload}>
            {
                hasImagesMetadata ?
                <div> { store.imagesMetadata[selectedLanguageCode].map((currentImg, index) => {
                    return (
                        <div key={selectedLanguageCode + index}>
                            <PrizeImage
                                store={store}
                                currentImg={currentImg}
                                index={index}
                                onChangeFileUpload={onChangeFileUpload}
                                onFileItemRemoval={onFileItemRemoval}
                                onImageMetadataChange={onImageMetadataChange}
                                onImageMetadataNameChange={onImageMetadataNameChange}

                            />
                        </div>
                        )
                    })
                }
                </div>
                : <PrizeImage
                    store={store}
                    onChangeFileUpload={onChangeFileUpload}
                    onImageMetadataChange={onImageMetadataChange}
                />
            }
            </div>

        const buttonComponent =
            <div>
                { withinImagesLimit &&
                    <Button
                    variant="contained"
                    className={classes.addPrizeButton}
                    onClick={() => onFileItemAddition()}
                    startIcon={<Add fontSize="small" />}
                    > Add Prize Image
                    </Button>
                }
            </div>

        return (
            <>
                { prizeImageComponent }
                { buttonComponent }
            </>
        )
    }
}

export default withStyles(styles)(PrizeImageList);
