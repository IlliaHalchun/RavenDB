﻿using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;
using Raven.Client.Documents.Operations.Backups;
using Raven.Server.Config;
using Raven.Server.Documents.PeriodicBackup.Azure;
using Raven.Server.ServerWide.Context;
using Raven.Server.Utils;

namespace Raven.Server.Documents.PeriodicBackup.Restore
{
    public class AzureRestorePoints : RestorePointsBase
    {
        private readonly RavenConfiguration _configuration;
        private readonly IRavenAzureClient _client;
        public AzureRestorePoints(RavenConfiguration configuration, SortedList<DateTime, RestorePoint> sortedList, TransactionOperationContext context, AzureSettings azureSettings) : base(sortedList, context)
        {
            _configuration = configuration;
            _client = RavenAzureClient.Create(azureSettings, configuration.Backup);
        }

        public override async Task FetchRestorePoints(string path)
        {
            await FetchRestorePointsForPath(path, assertLegacyBackups: true);
        }

        protected override async Task<List<FileInfoDetails>> GetFiles(string path)
        {
            var allObjects = await _client.ListBlobsAsync(path, delimiter: string.Empty, listFolders: false);

            var filesInfo = new List<FileInfoDetails>();

            foreach (var obj in allObjects.List)
            {
                if (TryExtractDateFromFileName(obj.Name, out var lastModified) == false)
                    continue;

                var fullPath = obj.Name;
                var directoryPath = GetDirectoryName(fullPath);
                filesInfo.Add(new FileInfoDetails(fullPath, directoryPath, lastModified));
            }

            return filesInfo;
        }

        protected override ParsedBackupFolderName ParseFolderNameFrom(string path)
        {
            var arr = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var lastFolderName = arr.Length > 0 ? arr[arr.Length - 1] : string.Empty;

            return ParseFolderName(lastFolderName);
        }

        protected override async Task<ZipArchive> GetZipArchive(string filePath)
        {
            var blob = await _client.GetBlobAsync(filePath);
            var file = await RestoreBackupTaskBase.CopyRemoteStreamLocally(blob.Data, _configuration);
            return new DeleteOnCloseZipArchive(file, ZipArchiveMode.Read);
        }

        protected override string GetFileName(string fullPath)
        {
            return fullPath.Split('/').Last();
        }

        public override void Dispose()
        {
            _client.Dispose();
        }
    }
}
