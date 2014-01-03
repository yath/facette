
function adminCollectionCreateGraph(value) {
    var $item = listAppend(listMatch('step-1-graphs'))
        .attr('data-graph', value.id)
        .data('value', value);

    domFillItem($item, value);

    return $item;
}

function adminCollectionGetData() {
    var $pane = paneMatch('collection-edit'),
        data = {
            name: $pane.find('input[name=collection-name]').val(),
            description: $pane.find('textarea[name=collection-desc]').val(),
            parent: ($pane.find('input[name=collection-parent]').data('value') || {}).id,
            entries: []
        };

    listMatch('step-1-graphs').find('[data-listitem^=step-1-graphs-item]').each(function () {
        var $item = $(this),
            $range = $item.find('input[name=graph-range]'),
            $title = $item.find('input[name=graph-title]');

        data.entries.push({
            id: $item.attr('data-graph'),
            options: {
                title: $title.val() || $title.attr('placeholder'),
                range: $range.val() || $range.attr('placeholder'),
                sample: $item.find('input[name=graph-sample]').val(),
                constants: $item.find('input[name=graph-constants]').val(),
                percentiles: $item.find('input[name=graph-percentiles]').val()
            }
        });
    });

    return data;
}

function adminCollectionUpdatePlaceholders(item) {
    var $title = item.find('input[name=graph-title]'),
        $range = item.find('input[name=graph-range]');

    $title.attr('placeholder', item.find('.name').text() + ' (' + ($range.val() || $range.attr('placeholder') ||
        GRAPH_DEFAULT_RANGE) + ')');
}

function adminCollectionSetupTerminate() {
    // Register admin panes
    paneRegister('collection-list', function () {
        // Register links
        linkRegister('edit-collection', function (e) {
            window.location = '/admin/collections/' + $(e.target).closest('[data-itemid]').attr('data-itemid');
        });

        linkRegister('clone-collection', function (e) {
            var $item = $(e.target).closest('[data-itemid]');

            overlayCreate('prompt', {
                message: $.t('collection.labl_collection_name'),
                value: $item.find('.name').text() + ' (clone)',
                callbacks: {
                    validate: function (data) {
                        if (!data)
                            return;

                        collectionSave($item.attr('data-itemid'), {
                            name: data
                        }, SAVE_MODE_CLONE).then(function () {
                            listUpdate($item.closest('[data-list]'),
                                $item.closest('[data-pane]').find('[data-listfilter=collections]').val());
                        });
                    }
                },
                labels: {
                    validate: {
                        text: $.t('collection.labl_clone')
                    }
                }
            });
        });

        linkRegister('remove-collection', function (e) {
            var $item = $(e.target).closest('[data-itemid]');

            overlayCreate('confirm', {
                message: $.t('collection.mesg_delete'),
                callbacks: {
                    validate: function () {
                        collectionDelete($item.attr('data-itemid'))
                            .then(function () {
                                listUpdate($item.closest('[data-list]'));
                            })
                            .fail(function () {
                                overlayCreate('alert', {
                                    message: $.t('collection.mesg_delete_fail')
                                });
                            });
                    }
                },
                labels: {
                    validate: {
                        text: $.t('collection.labl_delete'),
                        style: 'danger'
                    }
                }
            });
        });
    });

    paneRegister('collection-edit', function () {
        var collectionId = paneMatch('collection-edit').opts('pane').id || null;

        // Register completes and checks
        if ($('[data-input=graph]').length > 0) {
            inputRegisterComplete('graph', function (input) {
                return inputGetSources(input, {});
            });
        }

        if ($('[data-input=collection]').length > 0) {
            inputRegisterComplete('collection', function (input) {
                return inputGetSources(input, {
                    exclude: $(input).opts('input').exclude
                });
            });
        }

        if ($('[data-input=collection-name]').length > 0) {
            inputRegisterCheck('collection-name', function (input) {
                var value = input.find(':input').val();

                if (!value)
                    return;

                collectionList({
                    filter: value
                }).pipe(function (data) {
                    if (data !== null && data[0].id != collectionId) {
                        input
                            .attr('title', $.t('collection.mesg_exists'))
                            .addClass('error');
                    } else {
                        input
                            .removeAttr('title')
                            .removeClass('error');
                    }
                });
            });
        }

        // Register pane steps
        paneStepRegister('collection-edit', 1, function () {
            if (collectionId)
                listSay('step-1-graphs', null);

            setTimeout(function () { $('[data-step=1] fieldset input:first').trigger('change').select(); }, 0);
        });

        paneStepRegister('collection-edit', 2, function () {
            if (listMatch('step-1-graphs').find('[data-listitem^=step-1-graphs-item]').length === 0) {
                overlayCreate('alert', {
                    message: $.t('collection.mesg_graph_missing'),
                    callbacks: {
                        validate: function () {
                            setTimeout(function () { $('[data-step=1] fieldset input:first').select(); }, 0);
                        }
                    }
                });
                return false;
            }
        });

        // Register links
        linkRegister('remove-graph', function (e) {
            var $target = $(e.target),
                $list = $target.closest('[data-list]');

            $target.closest('[data-listitem]').remove();

            listUpdateCount($list);

            if ($list.find('[data-listitem^="' + $list.attr('data-list') + '-item"]').length === 0)
                listSay($list, $.t('graph.mesg_none'), 'info');

            PANE_UNLOAD_LOCK = true;
        });

        // Attach events
        $body
            .on('click', 'button', function (e) {
                var $graph,
                    $fieldset,
                    $item,
                    $list,
                    name,
                    skip = false;

                switch (e.target.name) {
                case 'graph-add':
                    if (e.target.disabled)
                        return;

                    $fieldset = $(e.target).closest('fieldset');
                    $list     = listMatch('step-1-graphs');
                    $graph    = $fieldset.find('input[name=graph]');

                    if (!$graph.data('value')) {
                        overlayCreate('alert', {
                            message: $.t('graph.mesg_unknown'),
                            callbacks: {
                                validate: function () {
                                    setTimeout(function () { $graph.select(); }, 0);
                                }
                            }
                        });

                        return;
                    }

                    $item = adminCollectionCreateGraph({
                        id: $graph.data('value').id,
                        name: $graph.val()
                    });

                    adminCollectionUpdatePlaceholders($item);

                    listSay($list, null);
                    listUpdateCount($list);

                    $graph.val('');

                    $graph
                        .trigger('change')
                        .focus();

                    PANE_UNLOAD_LOCK = true;

                    break;

                case 'step-cancel':
                    window.location = '/admin/collections/';
                    break;

                case 'step-save':
                    $(e.target).closest('[data-pane]').find('input[name=collection-name]').each(function () {
                        var $item = $(this);

                        if (!$item.val()) {
                            $item.closest('[data-input], textarea')
                                .attr('title', $.t('main.mesg_field_mandatory'))
                                .addClass('error');

                            skip = true;
                        }
                    });

                    if (skip) {
                        return;
                    }

                    collectionSave(collectionId, adminCollectionGetData())
                        .then(function () {
                            PANE_UNLOAD_LOCK = false;
                            window.location = '/admin/collections/';
                        })
                        .fail(function () {
                            overlayCreate('alert', {
                                message: $.t('collection.mesg_save_fail')
                            });
                        });

                    break;

                case 'step-ok':
                case 'step-prev':
                case 'step-next':
                    adminHandlePaneStep(e, name);
                    break;
                }
            })
            .on('change', '[data-step=1] fieldset input', function (e) {
                var $target = $(e.target),
                    $fieldset = $target.closest('fieldset'),
                    $button = $fieldset.find('button[name=graph-add]');

                if (!$fieldset.find('input[name=graph]').val())
                    $button.attr('disabled', 'disabled');
                else
                    $button.removeAttr('disabled');

                // Select next item
                if (!e._typing && $target.val())
                    $target.closest('[data-input]').nextAll('button:first').focus();
            })
            .on('change', '[data-step=1] .scrollarea :input, [data-step=2] :input', function (e) {
                PANE_UNLOAD_LOCK = true;

                if (e.target.name == 'graph-range')
                    adminCollectionUpdatePlaceholders($(e.target).closest('[data-graph]'));
            })
            .on('keyup', '[data-step=1] fieldset input', adminHandleFieldType);

        // Load collection data
        if (collectionId === null)
            return;

        collectionLoad(collectionId).pipe(function (data) {
            var $item,
                $listGraphs,
                $pane,
                i,
                query = {};

            $listGraphs = listMatch('step-1-graphs');

            for (i in data.entries) {
                $item = adminCollectionCreateGraph(data.entries[i]);
                $item.find('input[name=graph-title]').val(data.entries[i].options.title || '');
                $item.find('input[name=graph-range]').val(data.entries[i].options.range || '');
                $item.find('input[name=graph-sample]').val(data.entries[i].options.sample || '');
                $item.find('input[name=graph-constants]').val(data.entries[i].options.constants || '');
                $item.find('input[name=graph-percentiles]').val(data.entries[i].options.percentiles || '');
            }

            $pane = paneMatch('collection-edit');

            $pane.find('input[name=collection-name]').val(data.name);
            $pane.find('textarea[name=collection-desc]').val(data.description);

            if ($listGraphs.data('counter') === 0)
                listSay($listGraphs, $.t('graph.mesg_none'));

            listUpdateCount($listGraphs);

            // Load missing graph data
            if (collectionId)
                query.collection = collectionId;

            graphList(query).pipe(function (data) {
                var func = function () {
                        var $item = $(this);

                        domFillItem($item, data[i]);
                        adminCollectionUpdatePlaceholders($item);
                    },
                    i;

                for (i in data)
                    $listGraphs.find('[data-graph=' + data[i].id + ']').each(func);
            });
        });
    });
}
