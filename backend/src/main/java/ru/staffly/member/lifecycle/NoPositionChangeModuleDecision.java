package ru.staffly.member.lifecycle;
/** Decision for modules whose current lifecycle behavior has no user choice. */
public record NoPositionChangeModuleDecision(LifecycleModule module) implements PositionChangeModuleDecision { }
