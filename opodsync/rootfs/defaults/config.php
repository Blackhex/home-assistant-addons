<?php

namespace OPodSync;

const ENABLE_SUBSCRIPTIONS = false;
const TITLE = 'oPodSync';
const BASE_URL = 'http://localhost:3481';
const DISABLE_USER_METADATA_UPDATE = false;
const DATA_ROOT = '/config';
const CACHE_ROOT = DATA_ROOT . '/cache';
const DB_FILE = DATA_ROOT . '/data.sqlite';
const SQLITE_JOURNAL_MODE = 'WAL';
const ERRORS_SHOW = true;
const ERRORS_EMAIL = null;
const ERRORS_LOG = DATA_ROOT . '/error.log';
const ERRORS_REPORT_URL = null;
const DEBUG_LOG = DATA_ROOT . '/debug.log';
