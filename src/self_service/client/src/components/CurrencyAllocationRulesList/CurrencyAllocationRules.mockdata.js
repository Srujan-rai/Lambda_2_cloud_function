import React from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '@material-ui/core';
import { Edit as EditIcon } from '@material-ui/icons';

const rows = [
    {
        configurationId: "darensConfig",
        currencyId: "COIN",
        amount: 11,
        programId: "*",
        lotId: "*",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig",
        currencyId: "GEM",
        amount: 21,
        programId: "1741",
        lotId: "257",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig1",
        currencyId: "GEM",
        amount: 9,
        programId: "*",
        lotId: "*",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig1",
        currencyId: "COIN",
        amount: 14,
        programId: "113411",
        lotId: "221355",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig",
        currencyId: "COIN",
        amount: 11,
        programId: "*",
        lotId: "*",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig",
        currencyId: "GEM",
        amount: 21,
        programId: "1741",
        lotId: "257",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig1",
        currencyId: "GEM",
        amount: 9,
        programId: "*",
        lotId: "*",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "darensConfig1",
        currencyId: "COIN",
        amount: 14,
        programId: "113411",
        lotId: "221355",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    },
    {
        configurationId: "testConfig",
        currencyId: "TOKEN",
        amount: 777,
        programId: "123111",
        lotId: "1775",
        edit: <Link to="">
                  <IconButton><EditIcon /></IconButton>
              </Link>
    }
];

export default rows;