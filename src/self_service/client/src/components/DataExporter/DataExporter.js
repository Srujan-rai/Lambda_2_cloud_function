import React, { Component, createRef } from "react";
import { Button } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";
import { parse } from "json2csv";

const styles = {
    button: {
        marginTop: "1rem"
    }
};

class DataExporter extends Component {
    constructor(props) {
        super(props);
        this.blobLink = createRef();
        this.state = { blobUrl: "", blobName: "" };
    }

    handleClick = event => {
        event.preventDefault();
        const { header, data } = this.props;
        const fields = Object.keys(header);

        const csvString = parse(data, { fields });
        const object = new Blob([csvString], {
            type: "text/csv"
        });

        this.setState({
            blobUrl: URL.createObjectURL(object),
            blobName: `export-${new Date().getTime()}.csv`
        });
    };

    render() {
        const { format, classes } = this.props;
        const { blobUrl, blobName } = this.state;

        return (
            <>
                {blobUrl && (
                    <a
                        href={blobUrl}
                        ref={this.blobLink}
                        download={blobName}
                    />
                )}
                <Button
                    variant="contained"
                    color="primary"
                    className={classes.button}
                    onClick={this.handleClick}
                >
                    Export as {format.toUpperCase()}
                </Button>
            </>
        );
    }

    componentDidUpdate(_, prevState) {
        if (prevState.blobUrl !== this.state.blobUrl) {
            this.blobLink.current.click();
            URL.revokeObjectURL(this.state.blobUrl);
        }
    }
}

export default withStyles(styles)(DataExporter);
