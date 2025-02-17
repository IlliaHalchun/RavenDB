using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;
using Sparrow.Logging;
using Sparrow.Threading;

namespace Raven.Server.Utils.MicrosoftLogging;

[ProviderAlias("Sparrow")]
public class MicrosoftLoggingProvider : ILoggerProvider
{
    private readonly ConcurrentDictionary<string, SparrowLoggerWrapper> _loggers = new ConcurrentDictionary<string, SparrowLoggerWrapper>(StringComparer.Ordinal);
    public readonly MicrosoftLoggingConfiguration Configuration;
    
    private readonly LoggingSource _loggingSource;
    private readonly MultipleUseFlag _enable = new MultipleUseFlag();

    public bool IsActive => _enable.IsRaised();
    public (string, SparrowLoggerWrapper)[] Loggers => _loggers.Select(x => (x.Key, x.Value)).ToArray(); 
    
    public MicrosoftLoggingProvider(LoggingSource loggingSource, NotificationCenter.NotificationCenter notificationCenter)
    {
        _loggingSource = loggingSource;
        Configuration = new MicrosoftLoggingConfiguration(_loggers, notificationCenter);
    }

    public ILogger CreateLogger(string categoryName)
    {
        var lastDot = categoryName.LastIndexOf('.');
        (string source, string loggerName) = lastDot >= 0
            ? (categoryName[..lastDot], categoryName.Substring(lastDot + 1, categoryName.Length - lastDot - 1))
            : (categoryName, categoryName);
        var sparrowLogger = _loggingSource.GetLogger(source, loggerName);
        var logLevel = _enable.IsRaised() 
            ? Configuration.GetLogLevelForCategory(categoryName)
            : LogLevel.None;
        var newLogger = new SparrowLoggerWrapper(sparrowLogger, logLevel);
        return _loggers.GetOrAdd(categoryName, s => newLogger);
    }
    public IEnumerable<(string Name, LogLevel MinLogLevel)> GetLoggers()
    {
        return _loggers.Select(x => (x.Key, x.Value.MinLogLevel));
    }
    
    public void ApplyConfiguration()
    {
        _enable.Raise();
        foreach (var (categoryName, logger) in _loggers)
        {
            logger.MinLogLevel = Configuration.GetLogLevelForCategory(categoryName);
        }
    }
    
    public void DisableLogging()
    {
        _enable.Lower();
        foreach (var (_, logger) in _loggers)
        {
            logger.MinLogLevel = LogLevel.None;
        }
    }
    
    public void Dispose()
    {
        _loggers.Clear();
    }
}
