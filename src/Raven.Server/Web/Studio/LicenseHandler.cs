﻿using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http.Features.Authentication;
using Raven.Server.Commercial;
using Raven.Server.Documents.Handlers.Admin;
using Raven.Server.Json;
using Raven.Server.Routing;
using Sparrow.Json;

namespace Raven.Server.Web.Studio
{
    public class LicenseHandler : RequestHandler
    {
        [RavenAction("/license/status", "GET", RequiredAuthorization = AuthorizationStatus.ValidUser)]
        public Task Status()
        {
        
            using (var context = JsonOperationContext.ShortTermSingleUse())
            using (var writer = new BlittableJsonTextWriter(context, ResponseBodyStream()))
            {
                context.Write(writer, ServerStore.LicenseManager.GetLicenseStatus().ToJson());
            }

            return Task.CompletedTask;
        }
 
        [RavenAction("/admin/license/registration", "POST", RequiredAuthorization = AuthorizationStatus.ServerAdmin)]
        public async Task Register()
        {
            UserRegistrationInfo userInfo;

            using (var context = JsonOperationContext.ShortTermSingleUse())
            {
                var json = context.Read(RequestBodyStream(), "license registration form");
                userInfo = JsonDeserializationServer.UserRegistrationInfo(json);
            }

            await ServerStore.LicenseManager.RegisterForFreeLicense(userInfo).ConfigureAwait(false);

            NoContentStatus();
        }

        [RavenAction("/admin/license/activate", "POST", RequiredAuthorization = AuthorizationStatus.ServerAdmin)]
        public Task Activate()
        {
            License license;

            using (var context = JsonOperationContext.ShortTermSingleUse())
            {
                var json = context.Read(RequestBodyStream(), "license activation");
                license = JsonDeserializationServer.License(json);
            }

            ServerStore.LicenseManager.Activate(license, skipLeaseLicense: false);

            return NoContent();
        }
    }
}