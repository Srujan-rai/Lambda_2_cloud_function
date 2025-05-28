import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import classnames from 'classnames';
import { Avatar, Card, CardActions, CardHeader, CardMedia, CardContent, Collapse, IconButton, Typography } from '@material-ui/core';
import { ExpandMore as ExpandMoreIcon } from '@material-ui/icons';
import { red } from '@material-ui/core/colors';
import MenuItems from '../MenuItems';

const propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    avatar: PropTypes.string,
    actions: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        route: PropTypes.string.isRequired,
        icon: PropTypes.node
    })).isRequired,
    classes: PropTypes.object.isRequired
};

const defaultProps = {
    image: '',
    avatar: 'CC'
};

const styles = (theme) => ({
    expand: {
        transform: 'rotate(0deg)',
        transition: theme.transitions.create('transform', {
            duration: theme.transitions.duration.shortest
        }),
        marginLeft: 'auto',
        [theme.breakpoints.up('sm')]: {
            marginRight: -8
        }
    },
    expandOpen: {
        transform: 'rotate(180deg)'
    },
    avatar: {
        backgroundColor: red[500]
    }
});

class CardItem extends Component {
    state = {
        expanded: false
    };

    handleExpandClick = () => {
        this.setState(state => ({ expanded: !state.expanded }));
    };
 
    render() {
        const { classes, title, description, image, actions, avatar } = this.props;
        return (
            <Card>
                <CardHeader
                    avatar={<Avatar aria-label="Recipe" className={classes.avatar}>{avatar}</Avatar>}
                    title={<Typography variant="h6" gutterBottom>{title}</Typography>}
                />
                {(image && image.length) && 
                    <CardMedia className={classes.media} image={image} title={title} />
                }
                <CardContent>
                    <Typography component="p">{description}</Typography>
                </CardContent>
                <CardActions>
                    <IconButton
                        className={classnames(classes.expanded, {
                            [classes.expandOpen]: this.state.expanded,
                        })}
                        onClick={this.handleExpandClick}
                        aria-expanded={this.state.expanded}
                        aria-label="Show more"
                    >
                        <ExpandMoreIcon />
                    </IconButton>
                </CardActions>
                <Collapse in={this.state.expanded} timeout="auto" unmountOnExit>
                    <CardContent>
                       <MenuItems actions={actions} />
                    </CardContent>
                </Collapse>
            </Card>
        );
    };
};

CardItem.propTypes = propTypes;
CardItem.defaultProps = defaultProps;

export default withStyles(styles)(CardItem);