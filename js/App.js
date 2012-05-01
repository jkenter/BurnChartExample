Ext.define('BurnChartApp', {
    extend:'Rally.app.App',
    mixins: {
        messageable: 'Rally.Messageable'
    },
    layout: {
        type: 'hbox',
        align: 'stretch'
    },
    appName:'Burn Chart',
    cls:'burnchart',

    initComponent: function() {
        this.callParent(arguments);
        var piTree = Ext.widget('rallytree', {
            id: 'rallytree1',
            width: 400,
            height: '100%',
            topLevelModel: 'PortfolioItem',
            childModelTypeForRecordFn: function(record){
            	//if there are user stories, this is a portfolio item
            	if(record.get('UserStories') && record.get('UserStories').length > 0) {
            		return 'User Story';
            	} else if(record.get('Children') && record.get('Children').length > 0){
                    return 'PortfolioItem';
                } 
            },
            parentAttributeForChildRecordFn: function(record){
                if(record.get('PortfolioItemType') && record.get('Parent')){
                    return 'Parent';
                } else if (record.get('PortfolioItemType') && record.get('PortfolioItem')){
                	return 'PortfolioItem';
                } else if(record.get('Parent')){
                	return 'Parent';
                } else if(record.get('PortfolioItem')){
                	return 'PortfolioItem';
                }
            },
            listeners: {
                add: this._onTreeRowAdd,
                scope: this
            },
            topLevelStoreConfig: {
                listeners: {
                    beforeload: function(store) {
                        this.getEl().mask('Loading...');
                    },
                    load: function(store, records) {
                        if (records.length > 0) {
                            this.add({
                                id: 'chartCmp',
                                xtype: 'component',
                                flex: 1,
                                html: '<div>Choose a Portfolio Item from the list to see its burn chart.</div>'
                            })
                        }
                        this.getEl().unmask();
                    },
                    scope: this
                }
            },
            //override
            drawEmptyMsg: function(){
                if (Ext.getCmp('chartCmp')) {
                    Ext.getCmp('chartCmp').destroy();
                }
                this.add({
                    xtype: 'component',
                    html: '<p> No Portfolio Items within the currently scoped project(s).</p>'
                });
            }
        });
        this.add(piTree);

        //add the click handler to tree rows when they are added to the tree
        //this.down('#rallytree1').on('add', this._onTreeRowAdd, this);
    },

    launch: function () {
        this.chartQuery = {
            find:{
                _Type:'HierarchicalRequirement',
                Children:null,
                _ItemHierarchy: 12231
            }
        };

        this.chartConfigBuilder = Ext.create('Rally.app.analytics.BurnChartBuilder');

    },

    _afterChartConfigBuilt: function (success, chartConfig) {
        this._removeChartComponent();
        if (success){
            this.add({
                id: 'chartCmp',
                xtype: 'highchart',
                flex: 1,
                chartConfig: chartConfig
            });
        } else {
            var formattedId = this.selectedRowRecord.get('FormattedID');
            this.add({
                id: 'chartCmp',
                xtype: 'component',
                html: '<div>No user story data found for ' + formattedId + ' starting from: ' + this.startTime + '</div>'
            });
        }
    },

    _removeChartComponent: function() {
        var chartCmp = this.down('#chartCmp');
        if (chartCmp) {
            this.remove(chartCmp);
        }
    },

    _onTreeRowAdd: function(tree, treeRow) {
        treeRow.on('afterrender', this._afterTreeRowRendered, this);
    },

    _afterTreeRowRendered: function(treeRow) {
        treeRow.getEl().on('click', this._onTreeRowClick, this, {stopEvent: true});
    },

    _onTreeRowClick: function(event, treeRowTextEl) {
        var treeItem = Ext.getCmp(Ext.get(treeRowTextEl).findParentNode('.treeItem').id);
        var treeRowRecord = treeItem.getRecord();
        var itemId = treeRowRecord.get('ObjectID');
        var title = treeRowRecord.get('FormattedID') + ' - ' + treeRowRecord.get('Name');
        var startDateObj = treeRowRecord.get('ActualStartDate');
        startDateObj = startDateObj ? startDateObj : treeRowRecord.get('PlannedStartDate');
        if (!startDateObj) {
        	alert('The start date is not set for this item');
        	return;
        }
        var startYear = this._addZeroToDateIfNeeded(startDateObj.getUTCFullYear());
        var startMonth = this._addZeroToDateIfNeeded(startDateObj.getUTCMonth()+1);
        var startDay = this._addZeroToDateIfNeeded(startDateObj.getUTCDate());
        
        var startDate = startYear + "-" + startMonth + "-" + startDay + "T00:00:00Z";
        var endDateObj = treeRowRecord.get('PlannedEndDate');
        var endDate;
        if (endDateObj){
        	var endYear = endDateObj.getUTCFullYear();
        	var endMonth = this._addZeroToDateIfNeeded(endDateObj.getUTCMonth()+1);            
        	var endDay = this._addZeroToDateIfNeeded(endDateObj.getUTCDate());
            
        	endDate = endYear + "-" + endMonth + "-" + endDay + "T00:00:00Z";
        	console.log("endDate = " + endDate);
        }
        else {
        	console.log("Planned End Date does not exist!");
        }
        console.log('startDate: ' + startDate);
        this._refreshChart(treeRowRecord, itemId, title, startDate, endDate);
    },
    
    _addZeroToDateIfNeeded: function(dateValue) {
    	if (dateValue.toString().length < 2){
    		dateValue = "0" + dateValue;
        }
    	return dateValue;
    },

    _refreshChart: function(treeRowRecord, itemId, title, startDate, endDate) {
        this.selectedRowRecord = treeRowRecord;
        this.chartQuery.find._ItemHierarchy = itemId;
        this.down('#chartCmp').getEl().mask('Loading...');
        this.chartConfigBuilder.build(this.chartQuery, title, startDate, endDate, Ext.bind(this._afterChartConfigBuilt, this));
    }
});
