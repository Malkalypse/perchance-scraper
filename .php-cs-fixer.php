<?php

$config = new PhpCsFixer\Config();
return $config
    ->setIndent('  ')  // 2 spaces
    ->setLineEnding("\n")
    ->setRules([
        '@PSR12' => true,
        'indentation_type' => true,
        'array_indentation' => true,
        'braces' => ['allow_single_line_closure' => true],
        'binary_operator_spaces' => ['default' => 'single_space'],
        'blank_line_after_opening_tag' => true,
        'blank_line_between_import_groups' => false,
        'no_unused_imports' => true,
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'single_blank_line_at_eof' => true,
        'no_trailing_whitespace' => true,
        'no_whitespace_in_blank_line' => true,
        'spaces_inside_parentheses' => ['space' => 'single'], // Add space inside parentheses
        'no_spaces_after_function_name' => false, // Allow space after function name
    ])
    ->setFinder(
        PhpCsFixer\Finder::create()
            ->in(__DIR__ . '/web')
            ->name('*.php')
    );
