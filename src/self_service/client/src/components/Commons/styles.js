import { green, red, blue } from '@material-ui/core/colors';

const styles = {
    label: {
        width: "220px",
        marginLeft: "50px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    textField: {
        backgroundColor: "white",
        marginLeft: "50px",
        width: "200px",
        minHeight: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "5px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginBottom: "10px",
        marginTop: "5px"
    },
    error: {
        marginLeft: "50px",
        color: "red",
        fontWeight: "bold",
        fontSize: 12
    },
    rowContainer: {
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        minHeight: "30px"
    },
    select: {
        width: "260px",
        marginBottom: "5px",
        color: "black",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "20px",
        paddingTop: "3px",
        marginTop: "5px",
        marginLeft: "50px",
    },
    textArea: {
        marginLeft: "50px",
        marginTop: "10px",
        height: "180px",
        marginBottom: "70px",
        maxWidth: "460px",
        width: "460px"
    },
    fileUpload: {
        marginTop: "10px",
        marginBottom: "5px",
        marginLeft: "50px",
        color: "white",
        backgroundColor: "#f40000",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 1px #f40000",
        maxWidth: "210px"
    },
    headerChip: {
        margin: "30px 0px",
        fontSize: "16px"
    },
    fabWrapper: {
        position: "relative"
    },
    fabProgress: {
        color: green[300],
        position: 'absolute',
        top: -4,
        left: -4,
        zIndex: 1,
    },
    fabNormal: {
        backgroundColor: green[200]
    },
    fabOk: {
        backgroundColor: green[400]
    },
    fabFail: {
        backgroundColor: red[400]
    },
    cell: {
        marginLeft: "50px"
    }
};

export default styles;