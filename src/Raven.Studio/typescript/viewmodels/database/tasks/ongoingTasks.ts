import app = require("durandal/app");
import appUrl = require("common/appUrl");
import viewModelBase = require("viewmodels/viewModelBase");
import database = require("models/resources/database");
import databaseInfo = require("models/resources/info/databaseInfo");
import ongoingTasksCommand = require("commands/database/tasks/getOngoingTasksCommand");
import ongoingTaskReplicationListModel = require("models/database/tasks/ongoingTaskReplicationListModel");
import ongoingTaskBackupListModel = require("models/database/tasks/ongoingTaskBackupListModel");
import ongoingTaskRavenEtlListModel = require("models/database/tasks/ongoingTaskRavenEtlListModel");
import ongoingTaskSqlEtlListModel = require("models/database/tasks/ongoingTaskSqlEtlListModel");
import ongoingTaskSubscriptionListModel = require("models/database/tasks/ongoingTaskSubscriptionListModel");
import clusterTopologyManager = require("common/shell/clusterTopologyManager");
import createOngoingTask = require("viewmodels/database/tasks/createOngoingTask");
import ongoingTaskModel = require("models/database/tasks/ongoingTaskModel");
import deleteOngoingTaskCommand = require("commands/database/tasks/deleteOngoingTaskCommand");
import toggleOngoingTaskCommand = require("commands/database/tasks/toggleOngoingTaskCommand");
import databaseGroupGraph = require("models/database/dbGroup/databaseGroupGraph");
import getDatabaseCommand = require("commands/resources/getDatabaseCommand");

type TasksNamesInUI = "External Replication" | "RavenDB ETL" | "SQL ETL" | "Backup" | "Subscription";

class ongoingTasks extends viewModelBase {
    
    // Todo: Get info for db group topology ! members & promotable list..

    private clusterManager = clusterTopologyManager.default;
    myNodeTag = ko.observable<string>();

    private graph = new databaseGroupGraph();

    // The Ongoing Tasks Lists:
    replicationTasks = ko.observableArray<ongoingTaskReplicationListModel>(); 
    etlTasks = ko.observableArray<ongoingTaskRavenEtlListModel>();
    sqlTasks = ko.observableArray<ongoingTaskSqlEtlListModel>();
    backupTasks = ko.observableArray<ongoingTaskBackupListModel>();
    subscriptionTasks = ko.observableArray<ongoingTaskSubscriptionListModel>();

    existingTaskTypes = ko.observableArray<string>();
    selectedTaskType = ko.observable<string>();

    existingNodes = ko.observableArray<string>();
    selectedNode = ko.observable<string>();
    
    constructor() {
        super();
        this.bindToCurrentInstance("confirmRemoveOngoingTask", "confirmEnableOngoingTask", "confirmDisableOngoingTask");

        this.initObservables();
    }

    private initObservables() {
        this.myNodeTag(this.clusterManager.localNodeTag());
    }

    activate(args: any): JQueryPromise<any> {
        super.activate(args);
        
        this.addNotification(this.changesContext.serverNotifications()
            .watchDatabaseChange(this.activeDatabase().name, () => this.refresh()));
        this.addNotification(this.changesContext.serverNotifications().watchReconnect(() => this.refresh()));

        return $.when<any>(this.fetchDatabaseInfo(), this.fetchOngoingTasks());
    }

    attached() {
        super.attached();
        
        const db = this.activeDatabase();
        this.updateUrl(appUrl.forOngoingTasks(db));

        this.selectedTaskType("All tasks"); 
        this.selectedNode("All nodes"); 
    }

    compositionComplete(): void {
        super.compositionComplete();

        this.registerDisposableHandler($(document), "fullscreenchange", () => {
            $("body").toggleClass("fullscreen", $(document).fullScreen());
            this.graph.onResize();
        });
        
        this.graph.init($("#databaseGroupGraphContainer"));
    }

    private refresh() {
        return $.when<any>(this.fetchDatabaseInfo(), this.fetchOngoingTasks());
    }
    
    private fetchDatabaseInfo() {
        return new getDatabaseCommand(this.activeDatabase().name)
            .execute()
            .done(dbInfo => {
                this.graph.onDatabaseInfoChanged(dbInfo);
            });
    }

    private fetchOngoingTasks(): JQueryPromise<Raven.Server.Web.System.OngoingTasksResult> {
        const db = this.activeDatabase();
        return new ongoingTasksCommand(db)
            .execute()
            .done((info) => {
                this.processTasksResult(info);
                this.graph.onTasksChanged(info);
            });
    }

    private processTasksResult(result: Raven.Server.Web.System.OngoingTasksResult) { 
        this.replicationTasks([]);
        this.backupTasks([]);
        this.etlTasks([]);
        this.sqlTasks([]);
        this.subscriptionTasks([]);

        const taskTypesSet = new Set<TasksNamesInUI>();
        const nodesSet = new Set<string>();
      
        result.OngoingTasksList.map((task) => {
            
            // Note: responsible node can be null if node is in a re-hab state for example..
            if (task.ResponsibleNode.NodeTag) {
                nodesSet.add(task.ResponsibleNode.NodeTag);
            }

            switch (task.TaskType) {
                case 'Replication':
                    this.replicationTasks.push(new ongoingTaskReplicationListModel(task as Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskReplication));
                    taskTypesSet.add("External Replication");
                    break;
                case 'Backup':
                    this.backupTasks.push(new ongoingTaskBackupListModel(task as Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskBackup));
                    taskTypesSet.add("Backup");
                    break;
                case 'RavenEtl':
                    this.etlTasks.push(new ongoingTaskRavenEtlListModel(task as Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskRavenEtlListView));
                    taskTypesSet.add("RavenDB ETL");
                    break;
                case 'SqlEtl':
                    this.sqlTasks.push(new ongoingTaskSqlEtlListModel(task as Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskSqlEtlListView));
                    taskTypesSet.add("SQL ETL");
                    break;
                case 'Subscription': 
                    this.subscriptionTasks.push(new ongoingTaskSubscriptionListModel(task as Raven.Client.Documents.Operations.OngoingTasks.OngoingTaskSubscription)); 
                    taskTypesSet.add("Subscription");
                    break;
            };
        });

        this.existingTaskTypes(Array.from(taskTypesSet).sort());
        this.existingNodes(Array.from(nodesSet).sort());

        this.replicationTasks(_.sortBy(this.replicationTasks(), x => x.taskName().toUpperCase()));
        this.backupTasks(_.sortBy(this.backupTasks(), x => !x.taskName() ? "" : x.taskName().toUpperCase())); 
        this.etlTasks(_.sortBy(this.etlTasks(), x => x.taskName().toUpperCase())); 
        this.sqlTasks(_.sortBy(this.sqlTasks(), x => x.taskName().toUpperCase())); 
        this.subscriptionTasks(_.sortBy(this.subscriptionTasks(), x => x.taskName().toUpperCase())); 
    }

    manageDatabaseGroupUrl(dbInfo: databaseInfo): string {
        return appUrl.forManageDatabaseGroup(dbInfo);
    }

    confirmEnableOngoingTask(model: ongoingTaskModel) {
        const db = this.activeDatabase();

        this.confirmationMessage("Enable Task", "You're enabling task of type: " + model.taskType(), ["Cancel", "Enable"])
            .done(result => {
                if (result.can) {
                    new toggleOngoingTaskCommand(db, model.taskType(), model.taskId, model.taskName(), false)
                        .execute()
                        .done(() => model.taskState('Enabled'))
                        .always(() => this.fetchOngoingTasks());
                }
            });
    }

    confirmDisableOngoingTask(model: ongoingTaskModel) {
        const db = this.activeDatabase();

        this.confirmationMessage("Disable Task", "You're disabling task of type: " + model.taskType(), ["Cancel", "Disable"])
            .done(result => {
                if (result.can) {
                    new toggleOngoingTaskCommand(db, model.taskType(), model.taskId, model.taskName(), true)
                        .execute()
                        .done(() => model.taskState('Disabled'))
                        .always(() => this.fetchOngoingTasks());
                }
            });
    }

    confirmRemoveOngoingTask(model: ongoingTaskModel) {
        const db = this.activeDatabase();

        this.confirmationMessage("Delete Task", "You're deleting task of type: " + model.taskType(), ["Cancel", "Delete"])
            .done(result => {
                if (result.can) {
                    this.deleteOngoingTask(db, model);
                }
            });
    }

    private deleteOngoingTask(db: database, model: ongoingTaskModel) {
        new deleteOngoingTaskCommand(db, model.taskType(), model.taskId, model.taskName())
            .execute()
            .done(() => this.fetchOngoingTasks());
    }

    addNewOngoingTask() {
        const addOngoingTaskView = new createOngoingTask();
        app.showBootstrapDialog(addOngoingTaskView);
    }

    setSelectedTaskType(taskName: string) {
        this.selectedTaskType(taskName);
    }

    setSelectedNode(node: string) {
        this.selectedNode(node);
    }

}

export = ongoingTasks;
