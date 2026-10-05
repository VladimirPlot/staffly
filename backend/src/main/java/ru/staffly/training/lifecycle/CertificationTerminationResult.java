package ru.staffly.training.lifecycle;

/** Typed termination result; synchronization currently exposes no per-subject effects. */
public record CertificationTerminationResult(boolean audienceReconciled) { }
